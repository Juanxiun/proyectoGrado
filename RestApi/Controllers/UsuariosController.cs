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

    /// <summary>
    /// Lista paginada de usuarios.
    /// Query params: page, limit, rolId, estado, buscar.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var qs = UserServiceClient.ForwardQueryString(Request);
        var response = await _client.GetUsuariosAsync(qs, Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Obtiene un usuario por id con todas sus relaciones.
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetOne(long id)
    {
        var response = await _client.GetUsuarioAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Crea un usuario. Acepta application/json o multipart/form-data.
    ///
    /// Para multipart, enviar:
    ///   - datos: JSON string con los campos del usuario
    ///   - foto:  archivo PNG/JPG obligatorio (se valida y sube a MinIO)
    ///   - doc_file_{index}: archivo PDF opcional para cada documento
    /// </summary>
    [HttpPost]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Create()
    {
        if (Request.ContentLength == 0 && !Request.Headers.ContainsKey("Content-Type"))
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.CreateUsuarioAsync(Request);
        return await ProxyResult(response);
    }

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
        if (Request.ContentLength == 0 && !Request.Headers.ContainsKey("Content-Type"))
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.UpdateUsuarioAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>
    /// Elimina un usuario y su imagen en MinIO.
    /// </summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var response = await _client.DeleteUsuarioAsync(id, Request);
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
