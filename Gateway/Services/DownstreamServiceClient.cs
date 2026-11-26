using System.Net.Http.Headers;

namespace RestApi.Services;

// gateway -> cliente base streaming para reenvio a microservicios
public abstract class DownstreamServiceClient
{
    protected readonly HttpClient Http;

    protected DownstreamServiceClient(
        HttpClient http,
        IConfiguration config,
        string configKey,
        TimeSpan timeout,
        string? fallbackUrl = null)
    {
        Http = http;
        var baseUrl = config[configKey] ?? fallbackUrl
            ?? throw new InvalidOperationException($"{configKey} no configurado en appsettings.json");

        Http.BaseAddress = new Uri(baseUrl);
        Http.Timeout = timeout;
    }

    public Task<HttpResponseMessage> ForwardAsync(HttpMethod method, string path, HttpRequest request)
        => ForwardRequestAsync(method, path, request);

    public Task<HttpResponseMessage> HealthAsync()
        => Http.GetAsync("/health");

    protected virtual TimeSpan? GetRouteTimeout(string routePath) => null;

    protected virtual IReadOnlyList<string> ExtraForwardedHeaders => [];

    protected async Task<HttpResponseMessage> ForwardRequestAsync(
        HttpMethod method,
        string path,
        HttpRequest incomingRequest)
    {
        using var message = new HttpRequestMessage(method, path);

        var hasBody = incomingRequest.ContentLength is > 0
            || incomingRequest.Headers.ContainsKey("Transfer-Encoding")
            || (!HttpMethods.IsGet(incomingRequest.Method)
                && !HttpMethods.IsHead(incomingRequest.Method)
                && !HttpMethods.IsDelete(incomingRequest.Method)
                && incomingRequest.Headers.ContainsKey("Content-Type"));

        if (hasBody)
        {
            if (incomingRequest.Body.CanSeek)
            {
                incomingRequest.Body.Position = 0;
            }

            // gateway -> streaming directo sin duplicar archivos en memoria
            var streamContent = new StreamContent(incomingRequest.Body);
            if (!string.IsNullOrEmpty(incomingRequest.ContentType))
            {
                streamContent.Headers.TryAddWithoutValidation("Content-Type", incomingRequest.ContentType);
            }
            if (incomingRequest.ContentLength.HasValue)
            {
                streamContent.Headers.ContentLength = incomingRequest.ContentLength.Value;
            }
            message.Content = streamContent;
        }

        CopyHeaderIfPresent(incomingRequest, message, "Authorization");
        CopyHeaderIfPresent(incomingRequest, message, "User-Agent");
        CopyHeaderIfPresent(incomingRequest, message, "X-Forwarded-For");
        CopyHeaderIfPresent(incomingRequest, message, "X-Real-IP");
        CopyHeaderIfPresent(incomingRequest, message, "Accept");
        foreach (var header in ExtraForwardedHeaders)
        {
            CopyHeaderIfPresent(incomingRequest, message, header);
        }

        if (!message.Headers.Contains("X-Forwarded-For") && incomingRequest.HttpContext.Connection.RemoteIpAddress is { } ip)
        {
            message.Headers.TryAddWithoutValidation("X-Forwarded-For", ip.ToString());
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(incomingRequest.HttpContext.RequestAborted);
        var routePath = path.Split('?', 2)[0];
        if (GetRouteTimeout(routePath) is { } routeTimeout)
        {
            cts.CancelAfter(routeTimeout);
        }

        return await Http.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cts.Token);
    }

    private static void CopyHeaderIfPresent(HttpRequest src, HttpRequestMessage dest, string headerName)
    {
        if (src.Headers.TryGetValue(headerName, out var values))
        {
            dest.Headers.TryAddWithoutValidation(headerName, values.ToArray());
        }
    }

    public static string ForwardQueryString(HttpRequest request)
        => request.QueryString.HasValue ? request.QueryString.Value! : string.Empty;
}
