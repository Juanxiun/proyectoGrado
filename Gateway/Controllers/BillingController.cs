using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

[ApiController]
[Route("api")]
[Produces("application/json")]
public sealed class BillingController : ControllerBase
{
    private readonly BillingServiceClient _client;

    public BillingController(BillingServiceClient client) => _client = client;

    [HttpGet("economia/kpis")]
    public Task<IActionResult> GetKpis() => Proxy("/economia/kpis");

    [HttpGet("economia/estudiantes")]
    public Task<IActionResult> GetEconomyStudents() => Proxy("/economia/estudiantes");

    [HttpGet("economia/estudiantes/{id:long}")]
    public Task<IActionResult> GetEconomyStudent(long id) => Proxy($"/economia/estudiantes/{id}");

    [HttpGet("planos")]
    public Task<IActionResult> GetPlans() => Proxy("/planos");

    [HttpGet("planos/{id:long}")]
    public Task<IActionResult> GetPlan(long id) => Proxy($"/planos/{id}");

    [HttpPost("planos")]
    public Task<IActionResult> CreatePlan() => Proxy("/planos", HttpMethod.Post);

    [HttpPut("planos/{id:long}")]
    public Task<IActionResult> UpdatePlan(long id) => Proxy($"/planos/{id}", HttpMethod.Put);

    [HttpDelete("planos/{id:long}")]
    public Task<IActionResult> DeletePlan(long id) => Proxy($"/planos/{id}", HttpMethod.Delete);

    [HttpGet("cuotas")]
    public Task<IActionResult> GetInstallments() => Proxy("/cuotas");

    [HttpPut("cuotas/{id:long}")]
    public Task<IActionResult> UpdateInstallment(long id) => Proxy($"/cuotas/{id}", HttpMethod.Put);

    [HttpGet("pagos")]
    public Task<IActionResult> GetPayments() => Proxy("/pagos");

    [HttpPost("pagos")]
    public Task<IActionResult> RegisterPayment() => Proxy("/pagos", HttpMethod.Post);

    [HttpGet("estudiantes/{id:long}/deuda")]
    public Task<IActionResult> GetStudentDebt(long id) => Proxy($"/estudiantes/{id}/deuda");

    [HttpGet("periodos/{id:long}/DeudaEstudiantes")]
    public Task<IActionResult> GetPeriodDebts(long id) => Proxy($"/periodos/{id}/DeudaEstudiantes");

    private Task<IActionResult> Proxy(string path, HttpMethod? method = null)
    {
        var target = path + Request.QueryString.Value;
        return ProxyResponseFrom(_client.ForwardAsync(method ?? HttpMethod.Get, target, Request));
    }

    private static async Task<IActionResult> ProxyResponseFrom(Task<HttpResponseMessage> responseTask)
    {
        using var response = await responseTask;
        var body = await response.Content.ReadAsStringAsync();
        return new ContentResult
        {
            StatusCode = (int)response.StatusCode,
            Content = body,
            ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json; charset=utf-8",
        };
    }
}
