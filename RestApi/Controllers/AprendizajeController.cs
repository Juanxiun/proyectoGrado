using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/aprendizaje")]
[Produces("application/json")]
public sealed class AprendizajeController : ControllerBase
{
    private readonly HomeworkServiceClient _client;

    public AprendizajeController(HomeworkServiceClient client) => _client = client;

    [HttpGet("materiales/{id:long}")]
    public Task<IActionResult> GetLearningContent(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/aprendizaje/materiales/{id}", Request));

    [HttpPost("materiales/{id:long}/resumen")]
    public Task<IActionResult> CreateSummary(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/aprendizaje/materiales/{id}/resumen", Request));

    [HttpPost("materiales/{id:long}/explicar-seccion")]
    public Task<IActionResult> ExplainSection(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/aprendizaje/materiales/{id}/explicar-seccion", Request));

    [HttpPost("materiales/{id:long}/reto")]
    public Task<IActionResult> CreateChallenge(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/aprendizaje/materiales/{id}/reto{HomeworkServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("materiales/{id:long}/reto/{quizId}/completar")]
    public Task<IActionResult> CompleteChallenge(long id, string quizId)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/aprendizaje/materiales/{id}/reto/{Uri.EscapeDataString(quizId)}/completar", Request));

    [HttpPost("materiales/{id:long}/reto/{quizId}/comprobar-pareja")]
    public Task<IActionResult> CheckMatch(long id, string quizId)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/aprendizaje/materiales/{id}/reto/{Uri.EscapeDataString(quizId)}/comprobar-pareja", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
