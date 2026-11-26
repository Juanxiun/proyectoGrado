namespace RestApi.Services;

// gateway -> cliente servicio inscripciones
public sealed class EnrollmentServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:EnrollmentService", TimeSpan.FromMinutes(2));
