using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RestApi.Services;

/// <summary>
/// Validación mínima de JWT HS256. El gateway no autentica peticiones de
/// negocio (delega eso en cada microservicio), pero sí necesita comprobar el
/// token del cliente antes de dejarlo entrar a su grupo de notificaciones.
///
/// Se implementa a mano para no añadir un paquete NuGet al proyecto: basta con
/// verificar firma, algoritmo y expiración.
/// </summary>
public sealed class JwtTokenValidator
{
    private readonly byte[] _key;

    public JwtTokenValidator(IConfiguration config)
    {
        _key = Encoding.UTF8.GetBytes(config["Jwt:Secret"] ?? string.Empty);
    }

    public bool TryValidate(string? token, out string subject)
    {
        subject = string.Empty;
        if (string.IsNullOrWhiteSpace(token) || _key.Length == 0) return false;

        var trimmed = token.Trim();
        if (trimmed.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..].Trim();
        }

        var parts = trimmed.Split('.');
        if (parts.Length != 3) return false;

        try
        {
            var header = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(Base64UrlDecode(parts[0]));
            if (header is null
                || !header.TryGetValue("alg", out var alg)
                || !string.Equals(alg.GetString(), "HS256", StringComparison.Ordinal))
            {
                return false;
            }

            var expected = HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}"));
            var presented = Base64UrlDecode(parts[2]);
            if (!CryptographicOperations.FixedTimeEquals(expected, presented)) return false;

            var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(Base64UrlDecode(parts[1]));
            if (payload is null) return false;

            if (payload.TryGetValue("exp", out var exp) && exp.TryGetInt64(out var expUnix))
            {
                if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() >= expUnix) return false;
            }

            if (payload.TryGetValue("sub", out var sub))
            {
                subject = sub.GetString() ?? string.Empty;
            }

            return !string.IsNullOrWhiteSpace(subject);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '=');
        return Convert.FromBase64String(padded);
    }
}
