using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Controlador de autenticación. Reenvía las peticiones de login
/// al ServiceUser (Deno) vía webhook HTTP.
///
/// El ServiceUser devuelve un JWT que incluye la información del usuario
/// según su rol:
///   - director / gerencia / padres → id, username, rol
///   - estudiante                   → + nivel, grado, paralelo
///   - profesor                     → + lista de cursos y materias
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

    // ── POST /api/auth/login ──────────────────────────────────────────────────
    /// <summary>
    /// Autentica un usuario y devuelve un JWT.
    ///
    /// Body (application/json):
    /// {
    ///   "login":    "username o email",
    ///   "password": "contraseña"
    /// }
    ///
    /// Respuesta exitosa (200):
    /// {
    ///   "token": "...",
    ///   "usuario": {
    ///     "id", "username", "email", "nombre",
    ///     "apellidoPaterno", "apellidoMaterno",
    ///     "fotoUrl", "rol", "rolId",
    ///     // + campos extra según rol
    ///   }
    /// }
    /// </summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login()
    {
        var content = UserServiceClient.BuildForwardContent(Request);
        if (content is null)
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.LoginAsync(content);
        return await ProxyResult(response);
    }

    // ── Utilidad: proxy de resultado ──────────────────────────────────────────
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
