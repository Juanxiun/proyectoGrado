using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/materias")]
[Produces("application/json")]
public sealed class MateriasController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public MateriasController(AcademicServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/materias{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/materias/{id}", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/materias", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/materias/{id}", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/materias/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
