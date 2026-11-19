using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/evaluaciones-trimestrales")]
public sealed class EvaluacionesTrimestralesController : ControllerBase
{
    private readonly HomeworkServiceClient _client;

    public EvaluacionesTrimestralesController(HomeworkServiceClient client) => _client = client;

    [HttpGet("contexto")]
    public Task<IActionResult> GetContexto()
        => Proxy(_client.ForwardAsync(
            HttpMethod.Get,
            $"/evaluaciones-trimestrales/contexto{HomeworkServiceClient.ForwardQueryString(Request)}",
            Request));

    [HttpGet]
    public Task<IActionResult> List()
        => Proxy(_client.ForwardAsync(
            HttpMethod.Get,
            $"/evaluaciones-trimestrales{HomeworkServiceClient.ForwardQueryString(Request)}",
            Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetById(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/evaluaciones-trimestrales/{id}", Request));

    [HttpPost("generar")]
    public Task<IActionResult> Generar()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/evaluaciones-trimestrales/generar", Request));

    [HttpPatch("{id:long}/preguntas/{preguntaId}/estado")]
    public Task<IActionResult> ActualizarEstadoPregunta(long id, string preguntaId)
        => Proxy(_client.ForwardAsync(
            HttpMethod.Patch,
            $"/evaluaciones-trimestrales/{id}/preguntas/{Uri.EscapeDataString(preguntaId)}/estado",
            Request));

    [HttpPost("{id:long}/preguntas/{preguntaId}/regenerar")]
    public Task<IActionResult> RegenerarPregunta(long id, string preguntaId)
        => Proxy(_client.ForwardAsync(
            HttpMethod.Post,
            $"/evaluaciones-trimestrales/{id}/preguntas/{Uri.EscapeDataString(preguntaId)}/regenerar",
            Request));

    [HttpPost("{id:long}/aprobar")]
    public Task<IActionResult> Aprobar(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/evaluaciones-trimestrales/{id}/aprobar", Request));

    [HttpGet("{id:long}/pdf")]
    public Task<IActionResult> GetPdf(long id)
        => Proxy(_client.ForwardAsync(
            HttpMethod.Get,
            $"/evaluaciones-trimestrales/{id}/pdf{HomeworkServiceClient.ForwardQueryString(Request)}",
            Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/evaluaciones-trimestrales/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
    {
        try
        {
            return await ProxyResponse.From(await response);
        }
        catch (OperationCanceledException)
        {
            return new ObjectResult(new { error = "La operación tardó demasiado; inténtalo nuevamente." })
            {
                StatusCode = StatusCodes.Status504GatewayTimeout,
            };
        }
    }
}
