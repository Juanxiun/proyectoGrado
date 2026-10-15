namespace RestApi.Services;

public sealed class ControlAcademicoServiceClient
{
    private readonly HttpClient _http;

    public ControlAcademicoServiceClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        var baseUrl = config["Services:ControlAcademicoService"] ?? "http://localhost:8888";
        _http.BaseAddress = new Uri(baseUrl);
        _http.Timeout = TimeSpan.FromMinutes(2);
    }

    // Asistencia
    public Task<HttpResponseMessage> GetAsistenciasAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/asistencia{ForwardQueryString(request)}", request);

    public Task<HttpResponseMessage> GetAsistenciaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/asistencia/{id}", request);

    public Task<HttpResponseMessage> CreateAsistenciaAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/asistencia", request);

    public Task<HttpResponseMessage> CreateBulkAsistenciasAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/asistencia/bulk", request);

    public Task<HttpResponseMessage> UpdateAsistenciaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Put, $"/asistencia/{id}", request);

    public Task<HttpResponseMessage> DeleteAsistenciaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Delete, $"/asistencia/{id}", request);

    public Task<HttpResponseMessage> GetReporteAsistenciaAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/asistencia/reporte/curso{queryString}", request);

    public Task<HttpResponseMessage> GetAsistenciaEstudianteAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/asistencia/estudiante{queryString}", request);

    // Calificaciones
    public Task<HttpResponseMessage> GetCalificacionesAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/calificaciones{ForwardQueryString(request)}", request);

    public Task<HttpResponseMessage> GetCalificacionAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/calificaciones/{id}", request);

    public Task<HttpResponseMessage> CreateCalificacionAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/calificaciones", request);

    public Task<HttpResponseMessage> UpdateCalificacionAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Put, $"/calificaciones/{id}", request);

    public Task<HttpResponseMessage> BulkCalificacionesAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/calificaciones/bulk", request);

    public Task<HttpResponseMessage> GetReporteCalificacionesMateriaAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/calificaciones/reporte/materia{queryString}", request);

    // Temas
    public Task<HttpResponseMessage> GetTemasAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas{ForwardQueryString(request)}", request);

    public Task<HttpResponseMessage> GetTemaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas/{id}", request);

    public Task<HttpResponseMessage> CreateTemaAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/temas", request);

    public Task<HttpResponseMessage> UpdateTemaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Put, $"/temas/{id}", request);

    public Task<HttpResponseMessage> DeleteTemaAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Delete, $"/temas/{id}", request);

    public Task<HttpResponseMessage> GetProgresoEstudianteTemaAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas/progreso/estudiante{queryString}", request);

    public Task<HttpResponseMessage> GetTemasMateriaAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas/materia{queryString}", request);

    public Task<HttpResponseMessage> GetTemasPorUnidadAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas/unidad{queryString}", request);

    public Task<HttpResponseMessage> GetTemasEvaluacionAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/temas/evaluacion{queryString}", request);

    // Examenes
    public Task<HttpResponseMessage> GetExamenesAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/examenes{ForwardQueryString(request)}", request);

    public Task<HttpResponseMessage> GetExamenAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/examenes/{id}", request);

    public Task<HttpResponseMessage> CreateExamenAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/examenes", request);

    public Task<HttpResponseMessage> UpdateExamenAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Put, $"/examenes/{id}", request);

    public Task<HttpResponseMessage> DeleteExamenAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Delete, $"/examenes/{id}", request);

    public Task<HttpResponseMessage> ResponderExamenAsync(HttpRequest request)
        => ForwardAsync(HttpMethod.Post, "/examenes/responder", request);

    public Task<HttpResponseMessage> GetResultadosExamenAsync(long id, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/examenes/{id}/resultados", request);

    // Reportes
    public Task<HttpResponseMessage> GetReporteAsistenciaCursoAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/reportes/asistencia{queryString}", request);

    public Task<HttpResponseMessage> GetReporteCalificacionesAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/reportes/calificaciones{queryString}", request);

    public Task<HttpResponseMessage> GetReporteRiesgoAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/reportes/riesgo{queryString}", request);

    public Task<HttpResponseMessage> GetRankingMateriaAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/reportes/ranking/materia{queryString}", request);

    public Task<HttpResponseMessage> GetReportePDFAsync(string queryString, HttpRequest request)
        => ForwardAsync(HttpMethod.Get, $"/reportes/pdf{queryString}", request);

    // Health
    public Task<HttpResponseMessage> HealthAsync()
        => _http.GetAsync("/health");

    // metodo -> reenviar peticion con cabeceras
    private async Task<HttpResponseMessage> ForwardAsync(HttpMethod method, string path, HttpRequest incomingRequest)
    {
        using var message = new HttpRequestMessage(method, path);

        incomingRequest.EnableBuffering();
        if (incomingRequest.Body.CanSeek)
        {
            incomingRequest.Body.Position = 0;
        }

        if (incomingRequest.ContentLength > 0 || incomingRequest.Headers.ContainsKey("Content-Type"))
        {
            using var ms = new MemoryStream();
            await incomingRequest.Body.CopyToAsync(ms);
            var bytes = ms.ToArray();

            if (bytes.Length == 0 && incomingRequest.Body.CanSeek)
            {
                incomingRequest.Body.Position = 0;
                await incomingRequest.Body.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            var content = new ByteArrayContent(bytes);
            if (!string.IsNullOrEmpty(incomingRequest.ContentType))
            {
                content.Headers.TryAddWithoutValidation("Content-Type", incomingRequest.ContentType);
            }
            content.Headers.ContentLength = bytes.Length;
            message.Content = content;
        }

        CopyHeaderIfPresent(incomingRequest, message, "Authorization");
        CopyHeaderIfPresent(incomingRequest, message, "User-Agent");
        CopyHeaderIfPresent(incomingRequest, message, "X-Forwarded-For");
        CopyHeaderIfPresent(incomingRequest, message, "X-Real-IP");

        if (!message.Headers.Contains("X-Forwarded-For") && incomingRequest.HttpContext.Connection.RemoteIpAddress != null)
        {
            message.Headers.TryAddWithoutValidation("X-Forwarded-For", incomingRequest.HttpContext.Connection.RemoteIpAddress.ToString());
        }

        return await _http.SendAsync(message);
    }

    private static void CopyHeaderIfPresent(HttpRequest src, HttpRequestMessage dest, string headerName)
    {
        if (src.Headers.TryGetValue(headerName, out var values))
        {
            dest.Headers.TryAddWithoutValidation(headerName, values.ToArray());
        }
    }

    // proxy -> reenviar query string
    public static string ForwardQueryString(HttpRequest request)
        => request.QueryString.HasValue ? request.QueryString.Value! : string.Empty;
}