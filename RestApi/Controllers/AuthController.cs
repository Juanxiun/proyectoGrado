using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Controlador de autenticación, 2FA y gestión de sesiones.
/// Reenvía las peticiones al ServiceUser (Deno) vía webhook HTTP.
///
/// Características:
///   - 2FA para roles Director, Maestros y Control (códigos temporales en Redis enviados por correo).
///   - Control de sesión única para roles no-estudiantes (cierre automático de sesiones previas).
///   - Auditoría de sesiones múltiples y detección de trampas por distancia geográfica para estudiantes.
/// </summary>
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

    /// <summary>
    /// Autentica un usuario. Si el rol es Director, Maestro o Control, inicia el flujo 2FA.
    /// Si no requiere 2FA (ej. Estudiante), crea la sesión y devuelve el JWT directamente.
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login()
    {
        var response = await _client.LoginAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Valida el código 2FA de 6 dígitos enviado al correo del usuario y crea la sesión activa.
    /// </summary>
    [HttpPost("verify-2fa")]
    public async Task<IActionResult> Verify2FA()
    {
        var response = await _client.Verify2FAAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Reenvía un nuevo código 2FA al correo registrado.
    /// </summary>
    [HttpPost("resend-2fa")]
    public async Task<IActionResult> Resend2FA()
    {
        var response = await _client.Resend2FAAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Cierra la sesión activa del usuario, calcula el tiempo total conectado y audita el cierre.
    /// </summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var response = await _client.LogoutAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Lista las sesiones activas y el historial de sesiones del usuario actual (vía Bearer token).
    /// </summary>
    [HttpGet("sessions/me")]
    public async Task<IActionResult> GetMySessions()
    {
        var response = await _client.GetMySessionsAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Consulta las sesiones activas, historial e incidentes de posible trampa de un estudiante o usuario.
    /// </summary>
    [HttpGet("sessions/user/{id:long}")]
    public async Task<IActionResult> GetUserSessions(long id)
    {
        var response = await _client.GetUserSessionsAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Revoca o cierra remotamente una sesión específica.
    /// </summary>
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
