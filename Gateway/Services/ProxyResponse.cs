using Microsoft.AspNetCore.Mvc;

namespace RestApi.Services;

// gateway -> reenvio de respuestas json y binarias sin corromper streams
public static class ProxyResponse
{
    public static async Task<IActionResult> From(HttpResponseMessage response)
    {
        var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/json; charset=utf-8";
        var isTextOrJson = contentType.Contains("json", StringComparison.OrdinalIgnoreCase)
            || contentType.StartsWith("text/", StringComparison.OrdinalIgnoreCase);

        if (!isTextOrJson)
        {
            var bytes = await response.Content.ReadAsByteArrayAsync();
            var statusCode = (int)response.StatusCode;
            var fileName = response.Content.Headers.ContentDisposition?.FileNameStar
                ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"');
            var disposition = response.Content.Headers.ContentDisposition?.ToString();
            response.Dispose();

            return new BinaryProxyResult(bytes, contentType, statusCode, disposition, fileName);
        }

        var body = await response.Content.ReadAsStringAsync();
        var status = (int)response.StatusCode;
        response.Dispose();

        return new ContentResult
        {
            Content = body,
            ContentType = contentType,
            StatusCode = status,
        };
    }

    private sealed class BinaryProxyResult(
        byte[] payload,
        string contentType,
        int statusCode,
        string? contentDisposition,
        string? fileName) : IActionResult
    {
        public async Task ExecuteResultAsync(ActionContext context)
        {
            var httpResponse = context.HttpContext.Response;
            httpResponse.StatusCode = statusCode;
            httpResponse.ContentType = contentType;
            if (!string.IsNullOrWhiteSpace(contentDisposition))
            {
                httpResponse.Headers.ContentDisposition = contentDisposition;
            }
            else if (!string.IsNullOrWhiteSpace(fileName))
            {
                httpResponse.Headers.ContentDisposition = $"inline; filename=\"{fileName}\"";
            }
            httpResponse.ContentLength = payload.Length;
            await httpResponse.Body.WriteAsync(payload);
        }
    }
}
