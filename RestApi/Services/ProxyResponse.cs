using Microsoft.AspNetCore.Mvc;

namespace RestApi.Services;

public static class ProxyResponse
{
    public static async Task<IActionResult> From(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return new ContentResult
        {
            Content = body,
            ContentType = "application/json; charset=utf-8",
            StatusCode = (int)response.StatusCode,
        };
    }
}
