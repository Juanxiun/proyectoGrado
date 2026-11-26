namespace RestApi.Services;

// gateway -> cliente servicio academico
public sealed class AcademicServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:AcademicService", TimeSpan.FromMinutes(2));
