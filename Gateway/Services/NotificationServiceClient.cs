namespace RestApi.Services;

// gateway -> cliente servicio notificaciones
public sealed class NotificationServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:NotificationService", TimeSpan.FromSeconds(30));
