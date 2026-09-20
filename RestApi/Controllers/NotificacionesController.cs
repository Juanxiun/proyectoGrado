using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/notificaciones")]
[Produces("application/json")]
public sealed class NotificacionesController : ControllerBase
{
    private readonly HomeworkServiceClient _client;

    public NotificacionesController(HomeworkServiceClient client)
    {
        _client = client;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var qs = HomeworkServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Get, $"/notificaciones{qs}", Request);
        return await ProxyResult(response);
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var qs = HomeworkServiceClient.ForwardQueryString(Request);
        var response = await _client.ForwardAsync(HttpMethod.Post, $"/notificaciones/{id}/read{qs}", Request);
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
