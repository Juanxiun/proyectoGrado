using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;
using RestApi.Services;

namespace RestApi.Controllers;

public sealed class ServiceCallbackDto
{
    public string EventId { get; set; } = string.Empty;
    public int Status { get; set; }
    public object? Data { get; set; }
    public string? Error { get; set; }
    public bool Partial { get; set; }
    public int? Progress { get; set; }
    public string? Stage { get; set; }
}

// gateway -> callbacks asincronos de microservicios hacia signalr
[ApiController]
[Route("api/webhooks")]
public sealed class WebhooksController(
    PendingRequestTracker tracker,
    IHubContext<AppHub> hubContext) : ControllerBase
{
    private static readonly HashSet<string> AllowedServices = new(StringComparer.OrdinalIgnoreCase)
    {
        "user-service",
        "academic-service",
        "enrollment-service",
        "homework-service",
        "notification-service",
        "dashboard-service",
        "control-academico-service",
        "billing-service",
        "gamification-service",
        "llm-service",
    };

    [HttpPost("{service}")]
    public async Task<IActionResult> ServiceCallback(string service, [FromBody] ServiceCallbackDto callback)
    {
        if (!AllowedServices.Contains(service))
        {
            return NotFound(new { error = $"Servicio de callback no reconocido: {service}" });
        }

        if (string.IsNullOrWhiteSpace(callback.EventId))
        {
            return BadRequest(new { error = "EventId es requerido en el Webhook Callback" });
        }

        if (callback.Partial)
        {
            if (tracker.TryGet(callback.EventId, out var activeConn) && activeConn is not null)
            {
                await hubContext.Clients.Client(activeConn).SendAsync("JobProgress", new
                {
                    requestId = callback.EventId,
                    service,
                    progress = callback.Progress,
                    stage = callback.Stage,
                    data = callback.Data,
                });
            }
            return Ok(new { received = true, partial = true, timestamp = DateTime.UtcNow.ToString("O") });
        }

        if (tracker.TryGetAndRemove(callback.EventId, out var connectionId) && connectionId is not null)
        {
            await hubContext.Clients.Client(connectionId).SendAsync("ReceiveResponse", new
            {
                requestId = callback.EventId,
                status = callback.Status,
                data = callback.Data,
                error = callback.Error,
            });
        }

        return Ok(new { received = true, timestamp = DateTime.UtcNow.ToString("O") });
    }
}
