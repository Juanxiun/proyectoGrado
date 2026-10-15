using Microsoft.AspNetCore.Mvc;
using RestApi.Filters;
using RestApi.Services;

namespace RestApi.Controllers;

/// <summary>Usuarios hacia ServiceUser; json y multipart.</summary>
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

    /// <summary>Lista paginada de usuarios.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var qs = UserServiceClient.ForwardQueryString(Request);
        var response = await _client.GetUsuariosAsync(qs, Request);
        return await ProxyResult(response);
    }

    /// <summary>Obtiene un usuario por id.</summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetOne(long id)
    {
        var response = await _client.GetUsuarioAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>Crea usuario en json o multipart.</summary>
    [HttpPost]
    [DisableRequestSizeLimit]
    [DisableFormValueModelBinding]
    public async Task<IActionResult> Create()
    {
        if (Request.ContentLength == 0 && !Request.Headers.ContainsKey("Content-Type"))
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.CreateUsuarioAsync(Request);
        return await ProxyResult(response);
    }

    /// <summary>Actualiza usuario en json o multipart.</summary>
    [HttpPut("{id:long}")]
    [DisableRequestSizeLimit]
    [DisableFormValueModelBinding]
    public async Task<IActionResult> Update(long id)
    {
        if (Request.ContentLength == 0 && !Request.Headers.ContainsKey("Content-Type"))
            return BadRequest(new { error = "El cuerpo del request está vacío" });

        var response = await _client.UpdateUsuarioAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>Baja lógica del usuario.</summary>
    [HttpPatch("{id:long}/baja")]
    public async Task<IActionResult> Baja(long id)
    {
        var response = await _client.BajaUsuarioAsync(id, Request);
        return await ProxyResult(response);
    }

    /// <summary>Elimina usuario y su imagen.</summary>
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
