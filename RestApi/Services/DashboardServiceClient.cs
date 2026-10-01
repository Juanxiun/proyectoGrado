namespace RestApi.Services;

/// <summary>
/// Cliente HTTP gateway hacia ServiceDashboard (tablero de inicio, sólo lectura).
/// </summary>
public sealed class DashboardServiceClient
{
    private readonly HttpClient _http;

    public DashboardServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:DashboardService"]
            ?? throw new InvalidOperationException("Services:DashboardService no configurado en appsettings.json");

        _http.BaseAddress = new Uri(baseUrl);
        // Las agregaciones del tablero son pesadas y se cachean unos segundos;
        // un timeout corto evita que la página de inicio se quede colgada.
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
