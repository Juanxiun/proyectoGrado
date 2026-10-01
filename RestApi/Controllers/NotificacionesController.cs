using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Bandeja de notificaciones. Toda la gestión vive en ServiceNotification; este
/// controlador sólo traduce /api → rutas del servicio.
/// </summary>
[ApiController]
[Route("api/notificaciones")]
[Produces("application/json")]
public sealed class NotificacionesController : ControllerBase
{
    private readonly NotificationServiceClient _client;

    public NotificacionesController(NotificationServiceClient client)
    {
        _client = client;
    }

    /// <summary>GET /api/notificaciones?usuarioId=&amp;unreadOnly=&amp;limit=</summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/notificaciones{qs}", Request);
        return await ProxyResult(response);
    }

    /// <summary>GET /api/notificaciones/conteo — alimenta el badge del encabezado.</summary>
    [HttpGet("conteo")]
    public async Task<IActionResult> Count()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/notificaciones/conteo{qs}", Request);
        return await ProxyResult(response);
    }

    /// <summary>GET /api/notificaciones/reglas — catálogo de eventos notificados.</summary>
    [HttpGet("reglas")]
    public async Task<IActionResult> Rules()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/notificaciones/reglas{qs}", Request);
        return await ProxyResult(response);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id)
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/notificaciones/{id}{qs}", Request);
        return await ProxyResult(response);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Post, $"/notificaciones/{id}/read{qs}", Request);
        return await ProxyResult(response);
    }

    [HttpPost("leer-todas")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Post, $"/notificaciones/leer-todas{qs}", Request);
        return await ProxyResult(response);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Remove(string id)
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Delete, $"/notificaciones/{id}{qs}", Request);
        return await ProxyResult(response);
    }

    /// <summary>POST /api/notificaciones/emitir — disparo puntual (uso de dirección/control).</summary>
    [HttpPost("emitir")]
    public async Task<IActionResult> Emit()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Post, $"/notificaciones/emitir{qs}", Request);
        return await ProxyResult(response);
    }

    /// <summary>GET /api/notificaciones/estado — estado del bus de eventos.</summary>
    [HttpGet("estado")]
    public async Task<IActionResult> Status()
    {
        var qs = NotificationServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/eventos/estado{qs}", Request);
        return await ProxyResult(response);
    }

    private static async Task<IActionResult> ProxyResult(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json";
        return new ContentResult
        {
            StatusCode = (int)response.StatusCode,
            Content = body,
            ContentType = contentType
        };
    }
}
