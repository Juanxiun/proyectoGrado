using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;
using RestApi.Services;

namespace RestApi.Controllers;

public sealed class UserServiceCallbackDto
{
    public string EventId { get; set; } = string.Empty;
    public int Status { get; set; }
    public object? Data { get; set; }
    public string? Error { get; set; }
}

[ApiController]
[Route("api/webhooks")]
public sealed class WebhooksController : ControllerBase
{
    private readonly PendingRequestTracker _tracker;
    private readonly IHubContext<AppHub> _hubContext;

    public WebhooksController(PendingRequestTracker tracker, IHubContext<AppHub> hubContext)
    {
        _tracker = tracker;
        _hubContext = hubContext;
    }

    [HttpPost("user-service")]
    public async Task<IActionResult> UserServiceCallback([FromBody] UserServiceCallbackDto callback)
    {
        if (string.IsNullOrWhiteSpace(callback.EventId))
        {
            return BadRequest(new { error = "EventId es requerido en el Webhook Callback" });
        }

        if (_tracker.TryGetAndRemove(callback.EventId, out var connectionId) && connectionId is not null)
        {
            await _hubContext.Clients.Client(connectionId).SendAsync("ReceiveResponse", new
            {
                requestId = callback.EventId,
                status = callback.Status,
                data = callback.Data,
                error = callback.Error
            });
        }
        else
        {
            // Opcionalmente notificar a todos los clientes o loguear si la conexión ya expiró
            Console.WriteLine($"[WebhooksController] No se encontró cliente WebSocket activo para eventId={callback.EventId}");
        }

        return Ok(new { received = true, timestamp = DateTime.UtcNow.ToString("O") });
    }
}
