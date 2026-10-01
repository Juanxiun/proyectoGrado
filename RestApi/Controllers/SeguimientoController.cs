using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Seguimiento académico: libro de notas, panel de desempeño y alertas de riesgo.
/// El cálculo vive en ServiceAcademic; el gateway sólo traduce y añade /api.
/// </summary>
[ApiController]
[Route("api/seguimiento")]
[Produces("application/json")]
public sealed class SeguimientoController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public SeguimientoController(AcademicServiceClient client) => _client = client;

    /// <summary>GET /api/seguimiento/libro?cursoPeriodoId=&amp;materiaId=&amp;trimestre=</summary>
    [HttpGet("libro")]
    public Task<IActionResult> Libro()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/seguimiento/libro{Qs()}", Request));

    /// <summary>GET /api/seguimiento/panel/curso?cursoPeriodoId=&amp;trimestre=</summary>
    [HttpGet("panel/curso")]
    public Task<IActionResult> PanelCurso()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/seguimiento/panel/curso{Qs()}", Request));

    /// <summary>GET /api/seguimiento/panel/estudiante/{id}?periodoId=&amp;trimestre=</summary>
    [HttpGet("panel/estudiante/{id}")]
    public Task<IActionResult> PanelEstudiante(string id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/seguimiento/panel/estudiante/{id}{Qs()}", Request));

    /// <summary>GET /api/seguimiento/riesgo?periodoId=&amp;trimestre=&amp;limite=</summary>
    [HttpGet("riesgo")]
    public Task<IActionResult> Riesgo()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/seguimiento/riesgo{Qs()}", Request));

    /// <summary>GET /api/seguimiento/umbrales — criterio de riesgo vigente.</summary>
    [HttpGet("umbrales")]
    public Task<IActionResult> Umbrales()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, "/seguimiento/umbrales", Request));

    private string Qs() => Request.QueryString.HasValue ? Request.QueryString.Value! : string.Empty;

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> responseTask)
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
