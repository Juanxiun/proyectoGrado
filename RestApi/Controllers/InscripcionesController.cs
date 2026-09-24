using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/inscripciones")]
[Produces("application/json")]
public sealed class InscripcionesController : ControllerBase
{
    private readonly EnrollmentServiceClient _client;

    public InscripcionesController(EnrollmentServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/inscripciones{EnrollmentServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("solicitud")]
    public Task<IActionResult> CreateRequest()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/inscripciones/solicitud", Request));

    [HttpPost("habilitar")]
    public Task<IActionResult> Enable()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/inscripciones/habilitar", Request));

    [HttpGet("solicitudes")]
    public Task<IActionResult> ListRequests()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, "/inscripciones/solicitudes", Request));

    [HttpPatch("solicitudes/{id:long}/aprobar")]
    public Task<IActionResult> ApproveRequest(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Patch, $"/inscripciones/solicitudes/{id}/aprobar", Request));

    [HttpPatch("solicitudes/{id:long}/rechazar")]
    public Task<IActionResult> RejectRequest(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Patch, $"/inscripciones/solicitudes/{id}/rechazar", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/inscripciones/{id}", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/inscripciones", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/inscripciones/{id}", Request));

    [HttpPatch("{id:long}/retirar")]
    public Task<IActionResult> Retirar(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Patch, $"/inscripciones/{id}/retirar", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/inscripciones/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
