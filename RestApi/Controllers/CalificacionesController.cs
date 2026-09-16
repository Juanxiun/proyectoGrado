using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/calificaciones")]
[Produces("application/json")]
public sealed class CalificacionesController : ControllerBase
{
    private readonly HomeworkServiceClient _client;

    public CalificacionesController(HomeworkServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/calificaciones{HomeworkServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/calificaciones/{id}", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/calificaciones", Request));

    [HttpPost("bulk")]
    public Task<IActionResult> Bulk()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/calificaciones/bulk", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/calificaciones/{id}", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/calificaciones/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
