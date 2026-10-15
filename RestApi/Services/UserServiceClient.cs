namespace RestApi.Services;

// cliente -> reenviar peticiones serviceuser
public sealed class UserServiceClient
{
    private readonly HttpClient _http;

    public UserServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:UserService"]
            ?? throw new InvalidOperationException("Services:UserService no configurado en appsettings.json");

        _http.BaseAddress = new Uri(baseUrl);
        // timeout -> permitir subida minio
        _http.Timeout = TimeSpan.FromMinutes(2);
    }

    // proxy -> listar usuarios
    public Task<HttpResponseMessage> GetUsuariosAsync(string queryString, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/usuarios{queryString}", request);

    // proxy -> obtener usuario
    public Task<HttpResponseMessage> GetUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/usuarios/{id}", request);

    // proxy -> crear usuario
    public Task<HttpResponseMessage> CreateUsuarioAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/usuarios", request);

    // proxy -> actualizar usuario
    public Task<HttpResponseMessage> UpdateUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Put, $"/usuarios/{id}", request);

    // proxy -> baja logica usuario
    public Task<HttpResponseMessage> BajaUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Patch, $"/usuarios/{id}/baja", request);

    // proxy -> eliminar usuario
    public Task<HttpResponseMessage> DeleteUsuarioAsync(long id, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Delete, $"/usuarios/{id}", request);

    // proxy -> login usuario
    public Task<HttpResponseMessage> LoginAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/login", request);

    // proxy -> validar codigo 2fa
    public Task<HttpResponseMessage> Verify2FAAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/verify-2fa", request);

    // proxy -> reenviar codigo 2fa
    public Task<HttpResponseMessage> Resend2FAAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/resend-2fa", request);

    // proxy -> cambiar contrasena
    public Task<HttpResponseMessage> ChangePasswordAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/change-password", request);

    // proxy -> cerrar sesion
    public Task<HttpResponseMessage> LogoutAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Post, "/auth/logout", request);

    // proxy -> listar mis sesiones
    public Task<HttpResponseMessage> GetMySessionsAsync(HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, "/auth/sessions/me", request);

    // proxy -> listar sesiones usuario
    public Task<HttpResponseMessage> GetUserSessionsAsync(long userId, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Get, $"/auth/sessions/user/{userId}", request);

    // proxy -> revocar sesion
    public Task<HttpResponseMessage> RevokeSessionAsync(string sessionId, HttpRequest request)
        => ForwardRequestAsync(HttpMethod.Delete, $"/auth/sessions/{sessionId}", request);

    // proxy -> salud serviceuser
    public Task<HttpResponseMessage> HealthAsync()
        => _http.GetAsync("/health");

    // metodo -> reenviar peticion con cabeceras
    private async Task<HttpResponseMessage> ForwardRequestAsync(HttpMethod method, string path, HttpRequest incomingRequest)
    {
        using var message = new HttpRequestMessage(method, path);

        incomingRequest.EnableBuffering();
        if (incomingRequest.Body.CanSeek)
        {
            incomingRequest.Body.Position = 0;
        }

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

        CopyHeaderIfPresent(incomingRequest, message, "Authorization");
        CopyHeaderIfPresent(incomingRequest, message, "User-Agent");
        CopyHeaderIfPresent(incomingRequest, message, "X-Forwarded-For");
        CopyHeaderIfPresent(incomingRequest, message, "X-Real-IP");
        CopyHeaderIfPresent(incomingRequest, message, "X-Latitude");
        CopyHeaderIfPresent(incomingRequest, message, "X-Longitude");
        CopyHeaderIfPresent(incomingRequest, message, "X-Zona");
        CopyHeaderIfPresent(incomingRequest, message, "X-Ciudad");
        CopyHeaderIfPresent(incomingRequest, message, "X-Pais");

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

    // contenido -> reenviar cuerpo peticion
    public static HttpContent? BuildForwardContent(HttpRequest request)
    {
        if (request.ContentLength == 0 && !request.Headers.ContainsKey("Content-Type"))
            return null;

        var content = new StreamContent(request.Body);

        if (!string.IsNullOrEmpty(request.ContentType))
            content.Headers.TryAddWithoutValidation("Content-Type", request.ContentType);

        return content;
    }

    // proxy -> reenviar query string
    public static string ForwardQueryString(HttpRequest request)
        => request.QueryString.HasValue ? request.QueryString.Value! : string.Empty;
}
