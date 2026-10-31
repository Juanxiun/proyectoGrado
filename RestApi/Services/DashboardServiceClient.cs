namespace RestApi.Services;

// cliente -> reenviar servicio tablero
public sealed class DashboardServiceClient
{
    private readonly HttpClient _http;

    public DashboardServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:DashboardService"]
            ?? throw new InvalidOperationException("Services:DashboardService no configurado en appsettings.json");

        _http.BaseAddress = new Uri(baseUrl);
        // cache -> timeout corto tablero
        _http.Timeout = TimeSpan.FromSeconds(20);
    }

    public Task<HttpResponseMessage> ForwardAsync(HttpMethod method, string path, HttpRequest request)
        => ForwardRequestAsync(method, path, request);

    public Task<HttpResponseMessage> HealthAsync()
        => _http.GetAsync("/health");

    public static string ForwardQueryString(HttpRequest request)
        => request.QueryString.HasValue ? request.QueryString.Value! : string.Empty;

    private async Task<HttpResponseMessage> ForwardRequestAsync(HttpMethod method, string path, HttpRequest incomingRequest)
    {
        using var message = new HttpRequestMessage(method, path);

        if (incomingRequest.Headers.TryGetValue("Authorization", out var auth))
        {
            message.Headers.TryAddWithoutValidation("Authorization", auth.ToArray());
        }

        return await _http.SendAsync(message);
    }
}
