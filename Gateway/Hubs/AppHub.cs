using Microsoft.AspNetCore.SignalR;
using RestApi.Services;
using System.Text.Json;

namespace RestApi.Hubs;

public sealed class AppHub : Hub
{
    private readonly PendingRequestTracker _tracker;
    private readonly WebhookDispatcherService _webhookDispatcher;
    private readonly JwtTokenValidator _jwtValidator;

    public AppHub(
        PendingRequestTracker tracker,
        WebhookDispatcherService webhookDispatcher,
        JwtTokenValidator jwtValidator)
    {
        _tracker = tracker;
        _webhookDispatcher = webhookDispatcher;
        _jwtValidator = jwtValidator;
    }

    public async Task ExecuteAction(string requestId, string action, object? payload)
    {
        if (string.IsNullOrWhiteSpace(requestId))
        {
            await Clients.Caller.SendAsync("ReceiveResponse", new
            {
                requestId,
                status = 400,
                error = "requestId no proporcionado"
            });
            return;
        }

        if (!string.Equals(action, "auth.login", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(action, "login", StringComparison.OrdinalIgnoreCase)
            && !HasAuthenticationToken(payload))
        {
            await Clients.Caller.SendAsync("ReceiveResponse", new
            {
                requestId,
                status = 401,
                error = "Token de autenticación requerido"
            });
            return;
        }

        _tracker.Register(requestId, Context.ConnectionId);

        var dispatched = await _webhookDispatcher.DispatchAsync(requestId, action, payload);

        if (!dispatched)
        {
            _tracker.TryGetAndRemove(requestId, out _);
            await Clients.Caller.SendAsync("ReceiveResponse", new
            {
                requestId,
                status = 502,
                error = "No se pudo entregar el Webhook al servicio Backend"
            });
        }
    }

    // hub -> unir grupo notificaciones usuario
    public async Task SuscribirNotificaciones(string usuarioId, string authToken)
    {
        if (!_jwtValidator.TryValidate(authToken, out var subject))
        {
            await Clients.Caller.SendAsync("NotificacionSuscripcion", new
            {
                ok = false,
                error = "Token inválido o expirado"
            });
            return;
        }

        if (!string.IsNullOrWhiteSpace(usuarioId) && usuarioId != subject)
        {
            await Clients.Caller.SendAsync("NotificacionSuscripcion", new
            {
                ok = false,
                error = "El token no corresponde al usuario solicitado"
            });
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, NotificationGroups.ForUser(subject));
        await Clients.Caller.SendAsync("NotificacionSuscripcion", new
        {
            ok = true,
            usuarioId = subject
        });
    }

    private static bool HasAuthenticationToken(object? payload)
    {
        if (payload is null) return false;
        try
        {
            using var document = JsonDocument.Parse(JsonSerializer.Serialize(payload));
            if (document.RootElement.ValueKind != JsonValueKind.Object) return false;
            return new[] { "authToken", "authorization", "token" }
                .Any(name => document.RootElement.TryGetProperty(name, out var value)
                    && !string.IsNullOrWhiteSpace(value.GetString()));
        }
        catch
        {
            return false;
        }
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _tracker.RemoveByConnectionId(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
