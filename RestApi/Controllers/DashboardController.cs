using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Tablero de inicio. Sólo lectura: todas las rutas son GET salvo la
/// invalidación de caché, que es una acción de administración.
/// El recorte por rol lo aplica ServiceDashboard a partir del JWT.
/// </summary>
[ApiController]
[Route("api/dashboard")]
[Produces("application/json")]
public sealed class DashboardController : ControllerBase
{
    private readonly DashboardServiceClient _client;

    public DashboardController(DashboardServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> Get() => Proxy("/dashboard");

    [HttpGet("academico")]
    public Task<IActionResult> Academico() => Proxy("/dashboard/academico");

    [HttpGet("asistencia")]
    public Task<IActionResult> Asistencia() => Proxy("/dashboard/asistencia");

    [HttpGet("riesgo")]
    public Task<IActionResult> Riesgo() => Proxy("/dashboard/riesgo");

    [HttpGet("economico")]
    public Task<IActionResult> Economico() => Proxy("/dashboard/economico");

    [HttpGet("periodos")]
    public Task<IActionResult> Periodos() => Proxy("/dashboard/periodos");

    [HttpGet("umbrales")]
    public Task<IActionResult> Umbrales() => Proxy("/dashboard/umbrales");

    [HttpPost("cache/invalidar")]
    public Task<IActionResult> InvalidarCache() =>
        Proxy("/dashboard/cache/invalidar", HttpMethod.Post);

    private Task<IActionResult> Proxy(string path, HttpMethod? method = null)
    {
        var qs = DashboardServiceClient.ForwardQueryString(Request);
        var destino = path + qs;
        return ProxyResult(_client.ForwardAsync(method ?? HttpMethod.Get, destino, Request));
    }

    private static async Task<IActionResult> ProxyResult(Task<HttpResponseMessage> responseTask)
    {
        var response = await responseTask;
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
