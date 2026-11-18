namespace RestApi.Services;

// cliente -> servicio de gamificacion
public sealed class GamificationServiceClient
{
    private readonly HttpClient _http;

    public GamificationServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:GamificationService"]
            ?? throw new InvalidOperationException("Services:GamificationService no configurado");
        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromMinutes(2);
    }

    public async Task<HttpResponseMessage> ForwardAsync(HttpMethod method, string path, HttpRequest request)
    {
        using var message = new HttpRequestMessage(method, path);
        request.EnableBuffering();
        if (request.Body.CanSeek) request.Body.Position = 0;
        if (request.ContentLength > 0 || request.Headers.ContainsKey("Content-Type"))
        {
            using var stream = new MemoryStream();
            await request.Body.CopyToAsync(stream);
            message.Content = new ByteArrayContent(stream.ToArray());
            if (!string.IsNullOrEmpty(request.ContentType))
                message.Content.Headers.TryAddWithoutValidation("Content-Type", request.ContentType);
        }
        if (request.Headers.TryGetValue("Authorization", out var authorization))
            message.Headers.TryAddWithoutValidation("Authorization", authorization.ToArray());
        return await _http.SendAsync(message);
    }
}
