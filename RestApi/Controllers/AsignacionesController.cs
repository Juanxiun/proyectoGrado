using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/asignaciones")]
[Produces("application/json")]
public sealed class AsignacionesController : ControllerBase
{
    private readonly EnrollmentServiceClient _client;

    public AsignacionesController(EnrollmentServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/asignaciones{EnrollmentServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/asignaciones/{id}", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/asignaciones", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/asignaciones/{id}", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/asignaciones/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
