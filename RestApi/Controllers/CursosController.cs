using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api/cursos")]
[Produces("application/json")]
public sealed class CursosController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public CursosController(AcademicServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/cursos{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("{id:long}")]
    public Task<IActionResult> GetOne(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/cursos/{id}", Request));

    [HttpPost]
    public Task<IActionResult> Create()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/cursos", Request));

    [HttpPut("{id:long}")]
    public Task<IActionResult> Update(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/cursos/{id}", Request));

    [HttpDelete("{id:long}")]
    public Task<IActionResult> Delete(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/cursos/{id}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}

/// <summary>Materias por grado con todos sus paralelos.</summary>
[ApiController]
[Route("api/grados")]
[Produces("application/json")]
public sealed class GradosController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public GradosController(AcademicServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> GetAll()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/grados{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("materias")]
    public Task<IActionResult> ListMaterias()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/grados/materias{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("materias")]
    public Task<IActionResult> AddMateria()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/grados/materias{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPut("materias")]
    public Task<IActionResult> SetMaterias()
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/grados/materias{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpDelete("materias/{materiaId:long}")]
    public Task<IActionResult> RemoveMateria(long materiaId)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/grados/materias/{materiaId}{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}

/// <summary>Maya curricular reutilizable de temas por grado.</summary>
[ApiController]
[Route("api/malla")]
[Produces("application/json")]
public sealed class MayaCurricularController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public MayaCurricularController(AcademicServiceClient client) => _client = client;

    [HttpGet]
    public Task<IActionResult> Get()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/malla{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("resumen")]
    public Task<IActionResult> Resumen()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/malla/resumen{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("materia")]
    public Task<IActionResult> DeMateria()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/malla/materia{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPut("materia")]
    public Task<IActionResult> GuardarMateria()
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/malla/materia{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("tema")]
    public Task<IActionResult> CrearTema()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/malla/tema{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPut("tema/{id:long}")]
    public Task<IActionResult> ActualizarTema(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Put, $"/malla/tema/{id}{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpDelete("tema/{id:long}")]
    public Task<IActionResult> EliminarTema(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Delete, $"/malla/tema/{id}{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
