using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Produces("application/json")]
public sealed class AcademicManagementController : ControllerBase
{
    private readonly AcademicServiceClient _client;

    public AcademicManagementController(AcademicServiceClient client) => _client = client;

    [HttpPost("api/periodos/{id:long}/clonar")]
    public Task<IActionResult> Clone(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/clonar", Request));

    [HttpPost("api/periodos/{id:long}/clone")]
    public Task<IActionResult> CloneAlias(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/clone", Request));

    [HttpPost("api/periodos/{id:long}/generar-estructura")]
    public Task<IActionResult> GenerateStructure(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/generar-estructura", Request));

    [HttpPost("api/periodos/{id:long}/estructura/generar")]
    public Task<IActionResult> GenerateStructureAlias(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/estructura/generar", Request));

    [HttpPost("api/periodos/{id:long}/generar-cursos")]
    public Task<IActionResult> GenerateCourses(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/generar-cursos", Request));

    [HttpPost("api/periodos/{id:long}/generar-horarios")]
    public Task<IActionResult> GenerateSchedule(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/generar-horarios", Request));

    [HttpPost("api/periodos/{id:long}/horarios/generar")]
    public Task<IActionResult> GenerateScheduleAlias(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/horarios/generar", Request));

    [HttpPost("api/periodos/{id:long}/horarios/manual")]
    public Task<IActionResult> SaveManualScheduleForPeriod(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/horarios/manual", Request));

    [HttpPost("api/horarios/manual")]
    public Task<IActionResult> SaveManualSchedule()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/horarios/manual", Request));

    [HttpPost("api/periodos/{id:long}/generar-plan-pagos")]
    public Task<IActionResult> GeneratePaymentPlan(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/generar-plan-pagos", Request));

    [HttpPost("api/periodos/{id:long}/plan-pagos/generar")]
    public Task<IActionResult> GeneratePaymentPlanAlias(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/plan-pagos/generar", Request));

    [HttpPost("api/periodos/{id:long}/activar")]
    public Task<IActionResult> Activate(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Post, $"/periodos/{id}/activar", Request));

    [HttpGet("api/periodos/{id:long}/estado")]
    public Task<IActionResult> GetState(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}/estado", Request));

    [HttpGet("api/periodos/{id:long}/readiness")]
    public Task<IActionResult> GetReadiness(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}/readiness", Request));

    [HttpGet("api/periodos/{id:long}/validacion")]
    public Task<IActionResult> GetValidation(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}/validacion", Request));

    [HttpGet("api/periodos/{id:long}/validar")]
    public Task<IActionResult> ValidateAlias(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}/validar", Request));

    [HttpGet("api/periodos/{id:long}/trimestres")]
    public Task<IActionResult> GetTrimestersForPeriod(long id)
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/periodos/{id}/trimestres", Request));

    [HttpGet("api/trimestres")]
    public Task<IActionResult> GetTrimesters()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/trimestres{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpGet("api/horarios")]
    public Task<IActionResult> GetSchedules()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/horarios{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("api/horarios/generar")]
    public Task<IActionResult> GenerateSchedules()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/horarios/generar", Request));

    [HttpGet("api/mallas-curriculares")]
    public Task<IActionResult> GetCurriculum()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/mallas-curriculares{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("api/mallas-curriculares")]
    public Task<IActionResult> CreateCurriculumEntry()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/mallas-curriculares", Request));

    [HttpGet("api/planes-pago")]
    public Task<IActionResult> GetPaymentPlans()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, $"/planes-pago{AcademicServiceClient.ForwardQueryString(Request)}", Request));

    [HttpPost("api/planes-pago/generar")]
    public Task<IActionResult> GeneratePaymentPlans()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/planes-pago/generar", Request));

    [HttpGet("api/aulas")]
    public Task<IActionResult> GetAulas()
        => Proxy(_client.ForwardAsync(HttpMethod.Get, "/aulas", Request));

    [HttpPost("api/aulas")]
    public Task<IActionResult> CreateAula()
        => Proxy(_client.ForwardAsync(HttpMethod.Post, "/aulas", Request));

    private static async Task<IActionResult> Proxy(Task<HttpResponseMessage> response)
        => await ProxyResponse.From(await response);
}
