namespace RestApi.Services;

// gateway -> cliente servicio tareas y archivos pesados
public sealed class HomeworkServiceClient(HttpClient http, IConfiguration config)
    : DownstreamServiceClient(http, config, "Services:HomeworkService", TimeSpan.FromMinutes(10))
{
    protected override TimeSpan? GetRouteTimeout(string routePath)
        => routePath.EndsWith("/reto", StringComparison.OrdinalIgnoreCase)
            ? TimeSpan.FromSeconds(25)
            : null;
}
