// reintento -> reintentar conexiones muertas
const ERRORES_DE_CONEXION = new Set([
  // lista -> errores socket sistema
  "ECONNABORTED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  // lista -> errores sqlstate conexion
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "57P04",
]);

const MENSAJES_DE_CONEXION =
  /connection (terminated|closed|reset|refused)|terminating connection|terminated unexpectedly|server closed the connection|broken pipe|socket hang up|connection timeout/i;

// lista -> clases errores transporte
const CLASES_DE_CONEXION = new Set([
  "ConnectionError",
  "ConnectionAborted",
  "ConnectionTimeout",
  "ConnectionClosed",
]);

function esConexionMuerta(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    constructor?: { name?: string };
  };

  if (e.code != null && ERRORES_DE_CONEXION.has(String(e.code).toUpperCase())) return true;

  const clase = String(e.name ?? e.constructor?.name ?? "");
  if (CLASES_DE_CONEXION.has(clase)) return true;

  return MENSAJES_DE_CONEXION.test(String(e.message ?? ""));
}

// funcion -> reintentar consulta muerta
export async function conReintento<T>(
  intento: () => Promise<T>,
  etiqueta = "consulta",
): Promise<T> {
  const maxIntentos = 3;
  let ultimoError: unknown;

  for (let n = 1; n <= maxIntentos; n++) {
    try {
      return await intento();
    } catch (err) {
      if (!esConexionMuerta(err)) throw err;
      ultimoError = err;

      const codigo = (err as { code?: unknown }).code ??
        (err as { constructor?: { name?: string } }).constructor?.name ??
        "sin código";
      console.warn(
        `[db] Conexión caída en ${etiqueta} (intento ${n}/${maxIntentos}, ${codigo}); se reintenta`,
      );

      if (n < maxIntentos) {
        await new Promise((resolve) => setTimeout(resolve, 150 * n));
      }
    }
  }

  throw ultimoError;
}