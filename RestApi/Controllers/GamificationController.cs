using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

// controlador -> proxy servicio gamificacion
[ApiController]
[Route("api/gamificacion")]
[Produces("application/json")]
public sealed class GamificationController : ControllerBase
{
    private readonly GamificationServiceClient _client;

    public GamificationController(GamificationServiceClient client) => _client = client;

    [HttpGet("{**path}")]
    public Task<IActionResult> ProxyGet(string? path) => Proxy(path ?? "", HttpMethod.Get);

    [HttpPost("{**path}")]
    public Task<IActionResult> ProxyPost(string? path) => Proxy(path ?? "", HttpMethod.Post);

    [HttpPut("{**path}")]
    public Task<IActionResult> ProxyPut(string? path) => Proxy(path ?? "", HttpMethod.Put);

    [HttpDelete("{**path}")]
    public Task<IActionResult> ProxyDelete(string? path) => Proxy(path ?? "", HttpMethod.Delete);

    private Task<IActionResult> Proxy(string path, HttpMethod method)
    {
        var target = "/gamificacion/" + path.TrimStart('/') + Request.QueryString.Value;
        return ProxyResponseFrom(_client.ForwardAsync(method, target, Request));
    }

    private static async Task<IActionResult> ProxyResponseFrom(Task<HttpResponseMessage> responseTask)
    {
        using var response = await responseTask;
        var body = await response.Content.ReadAsStringAsync();
        return new ContentResult
        {
            StatusCode = (int)response.StatusCode,
            Content = body,
            ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json; charset=utf-8",
        };
    }
}
