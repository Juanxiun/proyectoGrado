namespace RestApi.Services;

// gateway -> cliente servicio usuarios y sesiones
public sealed class UserServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:UserService", TimeSpan.FromMinutes(2))
{
    private static readonly string[] GeoHeaders =
        ["X-Latitude", "X-Longitude", "X-Zona", "X-Ciudad", "X-Pais"];

    protected override IReadOnlyList<string> ExtraForwardedHeaders => GeoHeaders;

    public Task<HttpResponseMessage> GetUsuariosAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/usuarios{queryString}", request);

    public Task<HttpResponseMessage> GetUsuarioAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/usuarios/{id}", request);

    public Task<HttpResponseMessage> CreateUsuarioAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/usuarios", request);

    public Task<HttpResponseMessage> UpdateUsuarioAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Put, $"/usuarios/{id}", request);

    public Task<HttpResponseMessage> BajaUsuarioAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Patch, $"/usuarios/{id}/baja", request);

    public Task<HttpResponseMessage> DeleteUsuarioAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Delete, $"/usuarios/{id}", request);

    public Task<HttpResponseMessage> LoginAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/auth/login", request);

    public Task<HttpResponseMessage> Verify2FAAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/auth/verify-2fa", request);

    public Task<HttpResponseMessage> Resend2FAAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/auth/resend-2fa", request);

    public Task<HttpResponseMessage> ChangePasswordAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/auth/change-password", request);

    public Task<HttpResponseMessage> LogoutAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/auth/logout", request);

    public Task<HttpResponseMessage> GetMySessionsAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Get, "/auth/sessions/me", request);

    public Task<HttpResponseMessage> GetUserSessionsAsync(long userId, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/auth/sessions/user/{userId}", request);

    public Task<HttpResponseMessage> GetUserSessionAlertsAsync(long userId, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/auth/sessions/user/{userId}/alerts", request);

    public Task<HttpResponseMessage> RevokeSessionAsync(string sessionId, HttpRequest request)
        => ForwardAsync(HttpMethod.Delete, $"/auth/sessions/{sessionId}", request);
}
