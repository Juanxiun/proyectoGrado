namespace RestApi.Services;

/// <summary>
/// Cliente HTTP que actúa como webhook / API Gateway hacia el ServiceUser (Deno).
/// Todos los endpoints del RestApi reenvían las peticiones aquí.
/// </summary>
public sealed class UserServiceClient
{
    private readonly HttpClient _http;

    public UserServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:UserService"]
            ?? throw new InvalidOperationException("Services:UserService no configurado en appsettings.json");

        _http.BaseAddress = new Uri(baseUrl);
        // Fotos y documentos pueden ser multipart; permitir que MinIO complete la subida.
        _http.Timeout = TimeSpan.FromMinutes(2);
    }

    /// <summary>GET /usuarios con query string opcional.</summary>
    public Task<HttpResponseMessage> GetUsuariosAsync(string queryString, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/usuarios{queryString}", request);

    /// <summary>GET /usuarios/:id</summary>
    public Task<HttpResponseMessage> GetUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/usuarios/{id}", request);

    /// <summary>
    /// POST /usuarios — reenvía el cuerpo tal cual (JSON o multipart/form-data).
    /// </summary>
    public Task<HttpResponseMessage> CreateUsuarioAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/usuarios", request);

    /// <summary>
    /// PUT /usuarios/:id — reenvía el cuerpo tal cual.
    /// </summary>
    public Task<HttpResponseMessage> UpdateUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Put, $"/usuarios/{id}", request);

    /// <summary>PATCH /usuarios/:id/baja — baja lógica (estado inactivo).</summary>
    public Task<HttpResponseMessage> BajaUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Patch, $"/usuarios/{id}/baja", request);

    /// <summary>DELETE /usuarios/:id</summary>
    public Task<HttpResponseMessage> DeleteUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Delete, $"/usuarios/{id}", request);

    /// <summary>POST /auth/login — reenvía el cuerpo JSON y cabeceras de cliente.</summary>
    public Task<HttpResponseMessage> LoginAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/login", request);

    /// <summary>POST /auth/verify-2fa — valida el código 2FA de 6 dígitos.</summary>
    public Task<HttpResponseMessage> Verify2FAAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/verify-2fa", request);

    /// <summary>POST /auth/resend-2fa — reenvía un nuevo código 2FA.</summary>
    public Task<HttpResponseMessage> Resend2FAAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/resend-2fa", request);

    /// <summary>POST /auth/logout — cierra la sesión activa y calcula tiempo conectado.</summary>
    public Task<HttpResponseMessage> LogoutAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/logout", request);

    /// <summary>GET /auth/sessions/me — consulta sesiones del usuario actual.</summary>
    public Task<HttpResponseMessage> GetMySessionsAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, "/auth/sessions/me", request);

    /// <summary>GET /auth/sessions/user/:id — consulta sesiones y alertas de trampa de un usuario.</summary>
    public Task<HttpResponseMessage> GetUserSessionsAsync(long userId, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/auth/sessions/user/{userId}", request);

    /// <summary>DELETE /auth/sessions/:sessionId — revoca una sesión remota.</summary>
    public Task<HttpResponseMessage> RevokeSessionAsync(string sessionId, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Delete, $"/auth/sessions/{sessionId}", request);

    /// <summary>GET /health — verifica que el ServiceUser esté vivo.</summary>
    public Task<HttpResponseMessage> HealthAsync()
        => _http.GetAsync("/health");

    // ── Forwarding avanzado con cabeceras de auditoría y proxy ───────────────
    private async Task<HttpResponseMessage> ForwardRequestAsync(HttpMethod method, string path, HttpRequest incomingRequest)
    {
        using var message = new HttpRequestMessage(method, path);

        incomingRequest.EnableBuffering();
        if (incomingRequest.Body.CanSeek)
        {
            incomingRequest.Body.Position = 0;
        }

        // Reenviar cuerpo si existe
        if (incomingRequest.ContentLength > 0 || incomingRequest.Headers.ContainsKey("Content-Type"))
        {
            using var ms = new MemoryStream();
            await incomingRequest.Body.CopyToAsync(ms);
            var bytes = ms.ToArray();

            if (bytes.Length == 0 && incomingRequest.Body.CanSeek)
            {
                incomingRequest.Body.Position = 0;
                await incomingRequest.Body.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            var content = new ByteArrayContent(bytes);
            if (!string.IsNullOrEmpty(incomingRequest.ContentType))
            {
                content.Headers.TryAddWithoutValidation("Content-Type", incomingRequest.ContentType);
            }
            content.Headers.ContentLength = bytes.Length;
            message.Content = content;
        }

        // Reenviar cabeceras de autorización, cliente, IP y geolocalización
        CopyHeaderIfPresent(incomingRequest, message, "Authorization");
        CopyHeaderIfPresent(incomingRequest, message, "User-Agent");
        CopyHeaderIfPresent(incomingRequest, message, "X-Forwarded-For");
        CopyHeaderIfPresent(incomingRequest, message, "X-Real-IP");
        CopyHeaderIfPresent(incomingRequest, message, "X-Latitude");
        CopyHeaderIfPresent(incomingRequest, message, "X-Longitude");
        CopyHeaderIfPresent(incomingRequest, message, "X-Zona");
        CopyHeaderIfPresent(incomingRequest, message, "X-Ciudad");
        CopyHeaderIfPresent(incomingRequest, message, "X-Pais");

        // Si no viene X-Forwarded-For, pasar la IP remota de conexión
        if (!message.Headers.Contains("X-Forwarded-For") && incomingRequest.HttpContext.Connection.RemoteIpAddress != null)
        {
            message.Headers.TryAddWithoutValidation("X-Forwarded-For", incomingRequest.HttpContext.Connection.RemoteIpAddress.ToString());
        }

        return await _http.SendAsync(message);
    }

    private static void CopyHeaderIfPresent(HttpRequest src, HttpRequestMessage dest, string headerName)
    {
        if (src.Headers.TryGetValue(headerName, out var values))
        {
            dest.Headers.TryAddWithoutValidation(headerName, values.ToArray());
        }
    }

    /// <summary>
    /// Construye un <see cref="HttpContent"/> que reenvía el stream del cuerpo
    /// del request entrante, incluyendo el Content-Type (con boundary en multipart).
    /// </summary>
    public static HttpContent? BuildForwardContent(HttpRequest request)
    {
        if (request.ContentLength == 0 && !request.Headers.ContainsKey("Content-Type"))
            return null;

        var content = new StreamContent(request.Body);

        if (!string.IsNullOrEmpty(request.ContentType))
            content.Headers.TryAddWithoutValidation("Content-Type", request.ContentType);

        return content;
    }

    /// <summary>
    /// Construye el query string a reenviar al ServiceUser
    /// a partir del request actual.
    /// </summary>
    public static string ForwardQueryString(HttpRequest request)
        => request.QueryString.HasValue ? request.QueryString.Value! : string.Empty;
}
