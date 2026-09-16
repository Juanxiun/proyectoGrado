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
    public Task<IActionResult> UserServiceCallback([FromBody] ServiceCallbackDto callback)
        => CompleteCallback(callback);

    [HttpPost("academic-service")]
    public Task<IActionResult> AcademicServiceCallback([FromBody] ServiceCallbackDto callback)
        => CompleteCallback(callback);

    [HttpPost("enrollment-service")]
    public Task<IActionResult> EnrollmentServiceCallback([FromBody] ServiceCallbackDto callback)
        => CompleteCallback(callback);

    [HttpPost("homework-service")]
    public Task<IActionResult> HomeworkServiceCallback([FromBody] ServiceCallbackDto callback)
        => CompleteCallback(callback);

    private async Task<IActionResult> CompleteCallback(ServiceCallbackDto callback)
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
            Console.WriteLine($"[WebhooksController] No hay cliente SignalR activo para eventId={callback.EventId}");
        }

        return Ok(new { received = true, timestamp = DateTime.UtcNow.ToString("O") });
    }
}
