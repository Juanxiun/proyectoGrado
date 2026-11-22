namespace RestApi.Services;

// gateway -> cliente servicio gamificacion
public sealed class GamificationServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:GamificationService", TimeSpan.FromMinutes(2));
