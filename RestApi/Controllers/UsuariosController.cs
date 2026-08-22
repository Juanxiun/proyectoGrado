using Microsoft.AspNetCore.Mvc;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>
/// Controlador de usuarios. Actúa como API Gateway que reenvía
/// las peticiones al ServiceUser (Deno) vía webhook HTTP.
///
/// Soporta tanto application/json como multipart/form-data
/// (para subir fotos de perfil).
/// </summary>
[ApiController]
[Route("api/usuarios")]
[Produces("application/json")]
public sealed class UsuariosController : ControllerBase
{
    private readonly UserServiceClient _client;

    public UsuariosController(UserServiceClient client)
    {
        _client = client;
    }

    // ── GET /api/usuarios ─────────────────────────────────────────────────────
    /// <summary>
    /// Lista paginada de usuarios.
    /// Query params: page, limit, rolId, estado, buscar.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var qs = UserServiceClient.ForwardQueryString(Request);
        var response = await _client.GetUsuariosAsync(qs);
        return await ProxyResult(response);
    }

    // ── GET /api/usuarios/{id} ────────────────────────────────────────────────
    /// <summary>
    /// Obtiene un usuario por id con todas sus relaciones.
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetOne(long id)
    {
        var response = await _client.GetUsuarioAsync(id);
        return await ProxyResult(response);
    }

    // ── POST /api/usuarios ────────────────────────────────────────────────────
    /// <summary>
    /// Crea un usuario. Acepta application/json o multipart/form-data.
    ///
    /// Para multipart, enviar:
    ///   - datos: JSON string con los campos del usuario
    ///   - foto:  archivo de imagen (se convierte a WebP en el ServiceUser)
    /// </summary>
    [HttpPost]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Create()
    {
        var content = UserServiceClient.BuildForwardContent(Request);
        if (content is null)
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.CreateUsuarioAsync(content);
        return await ProxyResult(response);
    }

    // ── PUT /api/usuarios/{id} ────────────────────────────────────────────────
    /// <summary>
    /// Actualiza un usuario. Acepta application/json o multipart/form-data.
    ///
    /// Si se envía una nueva foto, se sobreescribe la imagen en MinIO
    /// conservando el nombre original.
    /// </summary>
    [HttpPut("{id:long}")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Update(long id)
    {
        var content = UserServiceClient.BuildForwardContent(Request);
        if (content is null)
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.UpdateUsuarioAsync(id, content);
        return await ProxyResult(response);
    }

    // ── DELETE /api/usuarios/{id} ─────────────────────────────────────────────
    /// <summary>
    /// Elimina un usuario y su imagen en MinIO.
    /// </summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var response = await _client.DeleteUsuarioAsync(id);
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
