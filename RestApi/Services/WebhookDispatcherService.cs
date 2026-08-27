using System.Text;
using System.Text.Json;

namespace RestApi.Services;

public sealed class WebhookDispatcherService
{
    private readonly HttpClient _http;
    private readonly string _userServiceWebhookUrl;
    private readonly string _gatewayCallbackUrl;

    public WebhookDispatcherService(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:UserService"] ?? "http://localhost:8000";
        _userServiceWebhookUrl = $"{baseUrl.TrimEnd('/')}/webhook";

        var gatewayBaseUrl = config["Gateway:PublicUrl"] ?? "http://localhost:5141";
        _gatewayCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/user-service";
    }

    public async Task<bool> DispatchToUserServiceAsync(string eventId, string eventType, object? payload)
    {
        var webhookPayload = new
        {
            eventId = eventId,
            eventType = eventType,
            callbackUrl = _gatewayCallbackUrl,
            timestamp = DateTime.UtcNow.ToString("O"),
            payload = payload
        };

        var json = JsonSerializer.Serialize(webhookPayload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await _http.PostAsync(_userServiceWebhookUrl, content);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WebhookDispatcher] Error enviando webhook a UserService: {ex.Message}");
            return false;
        }
    }
}
