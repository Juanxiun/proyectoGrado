using System.Text;
using System.Text.Json;

namespace RestApi.Services;

public sealed class WebhookDispatcherService
{
    private readonly HttpClient _http;
    private readonly string _userServiceWebhookUrl;
    private readonly string _academicServiceWebhookUrl;
    private readonly string _enrollmentServiceWebhookUrl;
    private readonly string _homeworkServiceWebhookUrl;
    private readonly string _notificationServiceWebhookUrl;
    private readonly string _dashboardServiceWebhookUrl;
    private readonly string _userCallbackUrl;
    private readonly string _academicCallbackUrl;
    private readonly string _enrollmentCallbackUrl;
    private readonly string _homeworkCallbackUrl;
    private readonly string _notificationCallbackUrl;
    private readonly string _dashboardCallbackUrl;

    public WebhookDispatcherService(HttpClient http, IConfiguration config)
    {
        _http = http;
        var userBase = config["Services:UserService"] ?? "http://localhost:8880";
        var academicBase = config["Services:AcademicService"] ?? "http://localhost:8881";
        var enrollmentBase = config["Services:EnrollmentService"] ?? "http://localhost:8882";
        var homeworkBase = config["Services:HomeworkService"] ?? "http://localhost:8883";
        var notificationBase = config["Services:NotificationService"] ?? "http://localhost:8884";
        var dashboardBase = config["Services:DashboardService"] ?? "http://localhost:8885";

        _userServiceWebhookUrl = $"{userBase.TrimEnd('/')}/webhook";
        _academicServiceWebhookUrl = $"{academicBase.TrimEnd('/')}/webhook";
        _enrollmentServiceWebhookUrl = $"{enrollmentBase.TrimEnd('/')}/webhook";
        _homeworkServiceWebhookUrl = $"{homeworkBase.TrimEnd('/')}/webhook";
        _notificationServiceWebhookUrl = $"{notificationBase.TrimEnd('/')}/webhook";
        _dashboardServiceWebhookUrl = $"{dashboardBase.TrimEnd('/')}/webhook";

        var gatewayBaseUrl = config["Gateway:PublicUrl"] ?? "http://localhost:5141";
        _userCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/user-service";
        _academicCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/academic-service";
        _enrollmentCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/enrollment-service";
        _homeworkCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/homework-service";
        _notificationCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/notification-service";
        _dashboardCallbackUrl = $"{gatewayBaseUrl.TrimEnd('/')}/api/webhooks/dashboard-service";
    }

    public Task<bool> DispatchAsync(string eventId, string eventType, object? payload)
    {
        // orden -> tablero notificaciones primero
        if (IsDashboardEvent(eventType))
        {
            return DispatchToDashboardServiceAsync(eventId, eventType, payload);
        }

        if (IsNotificationEvent(eventType))
        {
            return DispatchToNotificationServiceAsync(eventId, eventType, payload);
        }

        if (IsHomeworkEvent(eventType))
        {
            return DispatchToHomeworkServiceAsync(eventId, eventType, payload);
        }

        if (IsEnrollmentEvent(eventType))
        {
            return DispatchToEnrollmentServiceAsync(eventId, eventType, payload);
        }

        if (IsAcademicEvent(eventType))
        {
            return DispatchToAcademicServiceAsync(eventId, eventType, payload);
        }

        return DispatchToUserServiceAsync(eventId, eventType, payload);
    }

    public Task<bool> DispatchToUserServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_userServiceWebhookUrl, _userCallbackUrl, eventId, eventType, payload);

    public Task<bool> DispatchToAcademicServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_academicServiceWebhookUrl, _academicCallbackUrl, eventId, eventType, payload);

    public Task<bool> DispatchToEnrollmentServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_enrollmentServiceWebhookUrl, _enrollmentCallbackUrl, eventId, eventType, payload);

    public Task<bool> DispatchToHomeworkServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_homeworkServiceWebhookUrl, _homeworkCallbackUrl, eventId, eventType, payload);

    public Task<bool> DispatchToNotificationServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_notificationServiceWebhookUrl, _notificationCallbackUrl, eventId, eventType, payload);

    public Task<bool> DispatchToDashboardServiceAsync(string eventId, string eventType, object? payload)
        => PostWebhookAsync(_dashboardServiceWebhookUrl, _dashboardCallbackUrl, eventId, eventType, payload);

    private async Task<bool> PostWebhookAsync(
        string webhookUrl,
        string callbackUrl,
        string eventId,
        string eventType,
        object? payload)
    {
        var webhookPayload = new
        {
            eventId,
            eventType,
            callbackUrl,
            timestamp = DateTime.UtcNow.ToString("O"),
            payload
        };

        var json = JsonSerializer.Serialize(webhookPayload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await _http.PostAsync(webhookUrl, content);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WebhookDispatcher] Error enviando webhook a {webhookUrl}: {ex.Message}");
            return false;
        }
    }

    public static bool IsAcademicEvent(string eventType)
    {
        var type = (eventType ?? string.Empty).Trim().ToLowerInvariant();
        return type.StartsWith("periodos.")
            || type.StartsWith("trimestres.")
            || type.StartsWith("aulas.")
            || type.StartsWith("cursos.")
            || type.StartsWith("grados.")
            || type.StartsWith("materias.")
            || type.StartsWith("mallas-curriculares.")
            || type.StartsWith("malla.")
            || type.StartsWith("horarios.")
            || type.StartsWith("planes-pago.")
            || type.StartsWith("seguimiento.");
    }

    public static bool IsEnrollmentEvent(string eventType)
    {
        var type = (eventType ?? string.Empty).Trim().ToLowerInvariant();
        return type.StartsWith("cursosperiodo.")
            || type.StartsWith("cursos-periodo.")
            || type.StartsWith("inscripciones.")
            || type.StartsWith("asignaciones.")
            || type.StartsWith("asesores.");
    }

    public static bool IsHomeworkEvent(string eventType)
    {
        var type = (eventType ?? string.Empty).Trim().ToLowerInvariant();
        return type.StartsWith("materiales.")
            || type.StartsWith("encargos.")
            || type.StartsWith("calificaciones.")
            || type.StartsWith("asistencia.")
            || type.StartsWith("entregas.");
    }

    public static bool IsNotificationEvent(string eventType)
    {
        var type = (eventType ?? string.Empty).Trim().ToLowerInvariant();
        return type.StartsWith("notificaciones.")
            || type.StartsWith("notificacion.");
    }

    public static bool IsDashboardEvent(string eventType)
    {
        var type = (eventType ?? string.Empty).Trim().ToLowerInvariant();
        return type.StartsWith("dashboard.");
    }
}
