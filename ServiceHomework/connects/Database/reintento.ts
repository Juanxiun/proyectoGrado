/**
 * Reintento ante conexiones muertas.
 *
 * El pool de `@db/postgres` reconecta un cliente cuando `client.connected` pasa a
 * false, pero hay una ventana: si el peer manda un RST (Postgres reiniciado,
 * `pg_terminate_backend`, un idle timeout) el socket puede seguir marcado como
 * conectado y el primer `write` —o el primer `read` a mitad de una consulta—
 * revienta. Como el error salía en toda consulta, la pantalla se caía entera.
 *
 * La solución no es desconectar el pool: es reintentar. Para el segundo intento
 * la conexión ya figura caída, el pool abre un socket nuevo y la consulta pasa.
 *
 * Reintentar es seguro porque estos errores significan que la consulta NO llegó
 * al servidor: o se perdió en el socket local, o Postgres la rechazó al
 * arrancar. Un error de SQL (código 42xxx: sintaxis, unicidad, claves foráneas)
 * nunca entra en esta lista, así que no se reintenta un INSERT que sí se
 * ejecutó.
 */
const ERRORES_DE_CONEXION = new Set([
  // Errno del socket / del sistema operativo.
  "ECONNABORTED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  // SQLSTATE de conexión (clase 08) y de caída del servidor.
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

/**
 * Clases que el driver lanza para problemas de transporte. Esta es la señal más
 * fiable: cuando Postgres corta la sesión a mitad de una consulta,
 * `@db/postgres` lanza `ConnectionError: The session was terminated
 * unexpectedly` SIN código SQLSTATE, así que mirando sólo `code` el reintento
 * nunca se activaba.
 */
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

/**
 * Ejecuta `intento` y lo reintenta mientras el fallo sea una conexión muerta.
 *
 * Se permiten 3 intentos (el original más 2 reintentos) con una espera corta en
 * medio: si Postgres se está reiniciando de verdad, el segundo intento puede
 * caer en plena ejecución y el tercero ya encuentra la base estable.
 */
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