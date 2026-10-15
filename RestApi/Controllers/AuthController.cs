using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>Autenticación, 2FA y sesiones hacia ServiceUser.</summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController : ControllerBase
{
    private readonly UserServiceClient _client;

    public AuthController(UserServiceClient client)
    {
        _client = client;
    }

    /// <summary>Autentica usuario e inicia 2FA si aplica.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login()
    {
        var response = await _client.LoginAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Valida código 2FA y crea la sesión.</summary>
    [HttpPost("verify-2fa")]
    public async Task<IActionResult> Verify2FA()
    {
        var response = await _client.Verify2FAAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Reenvía nuevo código 2FA al correo.</summary>
    [HttpPost("resend-2fa")]
    public async Task<IActionResult> Resend2FA()
    {
        var response = await _client.Resend2FAAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Cambia contraseña con política segura.</summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword()
    {
        var response = await _client.ChangePasswordAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Cierra sesión y audita el tiempo conectado.</summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var response = await _client.LogoutAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Lista sesiones del usuario actual.</summary>
    [HttpGet("sessions/me")]
    public async Task<IActionResult> GetMySessions()
    {
        var response = await _client.GetMySessionsAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Consulta sesiones e incidentes de un usuario.</summary>
    [HttpGet("sessions/user/{id:long}")]
    public async Task<IActionResult> GetUserSessions(long id)
    {
        var response = await _client.GetUserSessionsAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>Revoca una sesión remotamente.</summary>
    [HttpDelete("sessions/{sessionId}")]
    public async Task<IActionResult> RevokeSession(string sessionId)
    {
        var response = await _client.RevokeSessionAsync(sessionId, Request);
        return await ProxyResult(response);
    }

    private static async Task<IActionResult> ProxyResult(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return new ContentResult
        {
            Content = body,
            ContentType = "application/json; charset=utf-8",
            StatusCode = (int)response.StatusCode,
        };
    }
}
