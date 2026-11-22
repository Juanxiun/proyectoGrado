using System.Net.Http.Json;

namespace RestApi.Services;

/// <summary>Enruta eventos del hub hacia el microservicio correspondiente sin acoplar el gateway a cada servicio.</summary>
public sealed class WebhookDispatcherService
{
    private static readonly TimeSpan DispatchTimeout = TimeSpan.FromSeconds(10);

    private readonly HttpClient _http;
    private readonly Dictionary<string, ServiceEndpoint> _endpoints;
    private readonly ServiceRoute[] _routes;

    private sealed record ServiceEndpoint(string WebhookUrl, string CallbackUrl);
    private sealed record ServiceRoute(Func<string, bool> Matches, string Service);

    public WebhookDispatcherService(HttpClient http, IConfiguration config)
    {
        _http = http;
        var gateway = (config["Gateway:PublicUrl"] ?? "http://localhost:5141").TrimEnd('/');
        _endpoints = new Dictionary<string, ServiceEndpoint>(StringComparer.OrdinalIgnoreCase)
        {
            ["User"] = BuildEndpoint(config, "UserService", 8880, gateway, "user-service"),
            ["Academic"] = BuildEndpoint(config, "AcademicService", 8881, gateway, "academic-service"),
            ["Enrollment"] = BuildEndpoint(config, "EnrollmentService", 8882, gateway, "enrollment-service"),
            ["Homework"] = BuildEndpoint(config, "HomeworkService", 8883, gateway, "homework-service"),
            ["Notification"] = BuildEndpoint(config, "NotificationService", 8884, gateway, "notification-service"),
            ["Dashboard"] = BuildEndpoint(config, "DashboardService", 8885, gateway, "dashboard-service"),
            ["ControlAcademico"] = BuildEndpoint(config, "ControlAcademicoService", 8888, gateway, "control-academico-service"),
        };
        // orden -> respeta la precedencia historica (dashboard/notificacion/homework antes que control)
        _routes =
        [
            new ServiceRoute(IsDashboardEvent, "Dashboard"),
            new ServiceRoute(IsNotificationEvent, "Notification"),
            new ServiceRoute(IsHomeworkEvent, "Homework"),
            new ServiceRoute(IsEnrollmentEvent, "Enrollment"),
            new ServiceRoute(IsAcademicEvent, "Academic"),
            new ServiceRoute(IsControlAcademicoEvent, "ControlAcademico"),
        ];
    }

    private static ServiceEndpoint BuildEndpoint(
        IConfiguration config,
        string section,
        int defaultPort,
        string gateway,
        string callbackPath)
    {
        var baseUrl = (config[$"Services:{section}"] ?? $"http://localhost:{defaultPort}").TrimEnd('/');
        return new ServiceEndpoint($"{baseUrl}/webhook", $"{gateway}/api/webhooks/{callbackPath}");
    }

    public Task<bool> DispatchAsync(
        string eventId,
        string eventType,
        object? payload,
        CancellationToken cancellationToken = default)
    {
        var service = _routes.FirstOrDefault(route => route.Matches(eventType))?.Service ?? "User";
        return PostWebhookAsync(_endpoints[service], eventId, eventType, payload, cancellationToken);
    }

    private async Task<bool> PostWebhookAsync(
        ServiceEndpoint endpoint,
        string eventId,
        string eventType,
        object? payload,
        CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(DispatchTimeout);

        var body = new
        {
            eventId,
            eventType,
            callbackUrl = endpoint.CallbackUrl,
            timestamp = DateTime.UtcNow.ToString("O"),
            payload,
        };

        try
        {
            using var response = await _http.PostAsJsonAsync(endpoint.WebhookUrl, body, timeout.Token);
            return response.IsSuccessStatusCode;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            Console.WriteLine($"[WebhookDispatcher] Timeout enviando webhook a {endpoint.WebhookUrl}");
            return false;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WebhookDispatcher] Error enviando webhook a {endpoint.WebhookUrl}: {ex.Message}");
            return false;
        }
    }

    public static bool IsAcademicEvent(string eventType)
    {
        var type = Normalize(eventType);
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
        var type = Normalize(eventType);
        return type.StartsWith("cursosperiodo.")
            || type.StartsWith("cursos-periodo.")
            || type.StartsWith("inscripciones.")
            || type.StartsWith("asignaciones.")
            || type.StartsWith("asesores.");
    }

    public static bool IsHomeworkEvent(string eventType)
    {
        var type = Normalize(eventType);
        return type.StartsWith("materiales.")
            || type.StartsWith("encargos.")
            || type.StartsWith("calificaciones.")
            || type.StartsWith("asistencia.")
            || type.StartsWith("entregas.");
    }

    public static bool IsNotificationEvent(string eventType)
    {
        var type = Normalize(eventType);
        return type.StartsWith("notificaciones.")
            || type.StartsWith("notificacion.");
    }

    public static bool IsDashboardEvent(string eventType)
        => Normalize(eventType).StartsWith("dashboard.");

    public static bool IsControlAcademicoEvent(string eventType)
    {
        var type = Normalize(eventType);
        return type.StartsWith("asistencia.")
            || type.StartsWith("calificaciones.")
            || type.StartsWith("temas.")
            || type.StartsWith("examenes.")
            || type.StartsWith("reportes.");
    }

    private static string Normalize(string eventType)
        => (eventType ?? string.Empty).Trim().ToLowerInvariant();
}
