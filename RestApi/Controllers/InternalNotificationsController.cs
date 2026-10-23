using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using RestApi.Hubs;

namespace RestApi.Controllers;

public sealed class NotificationPushDto
{
    /// <summary>Usuario destino; si se omite difunde a todos.</summary>
    public string? DestinatarioId { get; set; }
    public object? Notificacion { get; set; }
    public string Resource { get; set; } = "notificaciones";
}

/// <summary>Canal interno de push con token secreto.</summary>
[ApiController]
[Route("api/internal/notificaciones")]
public sealed class InternalNotificationsController : ControllerBase
{
    private readonly IHubContext<AppHub> _hubContext;
    private readonly IConfiguration _config;

    public InternalNotificationsController(IHubContext<AppHub> hubContext, IConfiguration config)
    {
        _hubContext = hubContext;
        _config = config;
    }

    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] NotificationPushDto push)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Token interno inválido" });
        }

        if (push?.Notificacion is null)
        {
            return BadRequest(new { error = "notificacion es requerida" });
        }

        if (!string.IsNullOrWhiteSpace(push.DestinatarioId))
        {
            var group = NotificationGroups.ForUser(push.DestinatarioId);
            await _hubContext.Clients.Group(group).SendAsync("NotificacionNueva", push.Notificacion);
        }
        else
        {
            await _hubContext.Clients.All.SendAsync("NotificacionNueva", push.Notificacion);
        }

        return Ok(new { received = true, destinatarioId = push.DestinatarioId });
    }

    private bool IsAuthorized()
    {
        var expected = _config["Internal:PushToken"];
        if (string.IsNullOrWhiteSpace(expected)) return false;

        var presented = Request.Headers["X-Internal-Token"].ToString();
        return !string.IsNullOrWhiteSpace(presented)
            && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(presented),
                System.Text.Encoding.UTF8.GetBytes(expected));
    }
}
