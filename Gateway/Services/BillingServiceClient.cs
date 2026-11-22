namespace RestApi.Services;

// gateway -> cliente servicio facturacion
public sealed class BillingServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:BillingService", TimeSpan.FromMinutes(2));
