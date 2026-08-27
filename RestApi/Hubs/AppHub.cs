using Microsoft.AspNetCore.SignalR;
using RestApi.Services;

namespace RestApi.Hubs;

public sealed class AppHub : Hub
{
    private readonly PendingRequestTracker _tracker;
    private readonly WebhookDispatcherService _webhookDispatcher;

    public AppHub(PendingRequestTracker tracker, WebhookDispatcherService webhookDispatcher)
    {
        _tracker = tracker;
        _webhookDispatcher = webhookDispatcher;
    }

    public async Task ExecuteAction(string requestId, string action, object? payload)
    {
        if (string.IsNullOrWhiteSpace(requestId))
        {
            await Clients.Caller.SendAsync("ReceiveResponse", new
            {
                requestId = requestId,
                status = 400,
                error = "requestId no proporcionado"
            });
            return;
        }

        // Registrar la solicitud pendiente vinculando requestId -> ConnectionId
        _tracker.Register(requestId, Context.ConnectionId);

        // Despachar evento webhook asíncrono al backend
        var dispatched = await _webhookDispatcher.DispatchToUserServiceAsync(requestId, action, payload);

        if (!dispatched)
        {
            _tracker.TryGetAndRemove(requestId, out _);
            await Clients.Caller.SendAsync("ReceiveResponse", new
            {
                requestId = requestId,
                status = 502,
                error = "No se pudo entregar el Webhook al servicio Backend"
            });
        }
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _tracker.RemoveByConnectionId(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
