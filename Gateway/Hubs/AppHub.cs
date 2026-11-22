using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using RestApi.Services;

namespace RestApi.Hubs;

// gateway -> hub websocket concurrente para procesos asincronos y notificaciones
public sealed class AppHub(
    PendingRequestTracker tracker,
    WebhookDispatcherService webhookDispatcher,
    JwtTokenValidator jwtValidator,
    IHubContext<AppHub> hubContext) : Hub
{
    private static readonly string[] AuthPropertyNames = ["authToken", "authorization", "token"];

    public Task ExecuteAction(string requestId, string action, object? payload)
    {
        if (string.IsNullOrWhiteSpace(requestId))
        {
            return Clients.Caller.SendAsync("ReceiveResponse", new { requestId, status = 400, error = "requestId no proporcionado" });
        }

        if (!IsLoginAction(action) && !HasAuthenticationToken(payload))
        {
            return Clients.Caller.SendAsync("ReceiveResponse", new { requestId, status = 401, error = "Token de autenticación requerido" });
        }

        var connectionId = Context.ConnectionId;
        tracker.Register(requestId, connectionId);

        // gateway -> despacho desacoplado sin bloquear el hilo del hub
        _ = Task.Run(async () =>
        {
            var dispatched = await webhookDispatcher.DispatchAsync(requestId, action, payload, CancellationToken.None);
            if (!dispatched && tracker.TryGetAndRemove(requestId, out var targetConn) && targetConn is not null)
            {
                await hubContext.Clients.Client(targetConn).SendAsync("ReceiveResponse", new
                {
                    requestId,
                    status = 502,
                    error = "No se pudo entregar el Webhook al servicio Backend",
                });
            }
        });

        return Clients.Caller.SendAsync("ActionAccepted", new
        {
            requestId,
            action,
            acceptedAt = DateTime.UtcNow.ToString("O"),
        });
    }

    // gateway -> suscribir cliente a grupo privado de notificaciones
    public async Task SuscribirNotificaciones(string usuarioId, string authToken)
    {
        if (!jwtValidator.TryValidate(authToken, out var subject))
        {
            await Clients.Caller.SendAsync("NotificacionSuscripcion", new
            {
                ok = false,
                error = "Token inválido o expirado",
            });
            return;
        }

        if (!string.IsNullOrWhiteSpace(usuarioId) && usuarioId != subject)
        {
            await Clients.Caller.SendAsync("NotificacionSuscripcion", new
            {
                ok = false,
                error = "El token no corresponde al usuario solicitado",
            });
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, NotificationGroups.ForUser(subject));
        await Clients.Caller.SendAsync("NotificacionSuscripcion", new
        {
            ok = true,
            usuarioId = subject,
        });
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        tracker.RemoveByConnectionId(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }

    private static bool IsLoginAction(string action)
        => string.Equals(action, "auth.login", StringComparison.OrdinalIgnoreCase)
            || string.Equals(action, "login", StringComparison.OrdinalIgnoreCase);

    private static bool HasAuthenticationToken(object? payload)
    {
        if (payload is null) return false;
        if (payload is JsonElement element) return HasAuthToken(element);
        try
        {
            using var document = JsonDocument.Parse(JsonSerializer.Serialize(payload));
            return HasAuthToken(document.RootElement);
        }
        catch
        {
            return false;
        }
    }

    private static bool HasAuthToken(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object) return false;
        return AuthPropertyNames.Any(name =>
            element.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            && !string.IsNullOrWhiteSpace(value.GetString()));
    }
}
