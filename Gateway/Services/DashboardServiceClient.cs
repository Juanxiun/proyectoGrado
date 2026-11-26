namespace RestApi.Services;

// gateway -> cliente servicio dashboard
public sealed class DashboardServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:DashboardService", TimeSpan.FromMinutes(2));
