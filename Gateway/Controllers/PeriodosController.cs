using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/periodos")]
[Produces("application/json")]
public sealed class PeriodosController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public PeriodosController(AcademicServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}", Request));

    [HttpPost("{id:long}/desactivar")]
    public Task<IActionResult> Deactivate(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/desactivar", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/periodos", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/periodos/{id}", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/periodos/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
