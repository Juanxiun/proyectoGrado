namespace RestApi.Services;

/// <summary>
/// Cliente HTTP gateway hacia ServiceNotification (Central de Notificaciones en Deno/Oak).
/// Es el único servicio que expone la bandeja de notificaciones del sistema.
/// </summary>
public sealed class NotificationServiceClient
{
    private readonly HttpClient _http;

    public NotificationServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:NotificationService"]
            ?? throw new InvalidOperationException("Services:NotificationService no configurado en appsettings.json");

        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromSeconds(30);
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

        if (!message.Headers.Contains("X-Forwarded-For") && incomingRequest.HttpContext.Connection.RemoteIpAddress != null)
        {
            message.Headers.TryAddWithoutValidation(
                "X-Forwarded-For",
                incomingRequest.HttpContext.Connection.RemoteIpAddress.ToString());
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
}
