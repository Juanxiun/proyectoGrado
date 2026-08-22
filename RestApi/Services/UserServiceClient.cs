namespace RestApi.Services;

/// <summary>
/// Cliente HTTP que actúa como webhook hacia el ServiceUser (Deno).
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
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    // ── Usuarios ─────────────────────────────────────────────────────────────

    /// <summary>GET /usuarios con query string opcional.</summary>
    public Task<HttpResponseMessage> GetUsuariosAsync(string queryString = "")
        => _http.GetAsync($"/usuarios{queryString}");

    /// <summary>GET /usuarios/:id</summary>
    public Task<HttpResponseMessage> GetUsuarioAsync(long id)
        => _http.GetAsync($"/usuarios/{id}");

    /// <summary>
    /// POST /usuarios — reenvía el cuerpo tal cual (JSON o multipart/form-data).
    /// </summary>
    public Task<HttpResponseMessage> CreateUsuarioAsync(HttpContent content)
        => _http.PostAsync("/usuarios", content);

    /// <summary>
    /// PUT /usuarios/:id — reenvía el cuerpo tal cual.
    /// </summary>
    public Task<HttpResponseMessage> UpdateUsuarioAsync(long id, HttpContent content)
        => _http.PutAsync($"/usuarios/{id}", content);

    /// <summary>DELETE /usuarios/:id</summary>
    public Task<HttpResponseMessage> DeleteUsuarioAsync(long id)
        => _http.DeleteAsync($"/usuarios/{id}");

    // ── Auth ──────────────────────────────────────────────────────────────────

    /// <summary>POST /auth/login — reenvía el cuerpo JSON.</summary>
    public Task<HttpResponseMessage> LoginAsync(HttpContent content)
        => _http.PostAsync("/auth/login", content);

    // ── Health ────────────────────────────────────────────────────────────────

    /// <summary>GET /health — verifica que el ServiceUser esté vivo.</summary>
    public Task<HttpResponseMessage> HealthAsync()
        => _http.GetAsync("/health");

    // ── Utilidades internas ───────────────────────────────────────────────────

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
