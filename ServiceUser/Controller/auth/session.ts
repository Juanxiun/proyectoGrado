import { Context, RouterContext } from "@oak/oak";
import { jwtVerify } from "jose";
import { jwtConfig } from "../../config/jwt.config.ts";
import { serialize } from "../../utils/serialize.ts";
import {
  closeSession,
  getUserSessions,
} from "../../services/session.service.ts";

let _jwtSecretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  if (!_jwtSecretKey) {
    _jwtSecretKey = new TextEncoder().encode(jwtConfig.secret);
  }
  return _jwtSecretKey;
}

// deno-lint-ignore no-explicit-any
async function extractPayloadFromHeader(ctx: Context): Promise<Record<string, any> | null> {
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7).trim();
  try {
    const verified = await jwtVerify(token, getSecretKey());
    return verified.payload;
  } catch {
    return null;
  }
}

/**
 * POST /auth/logout
 *
 * Body: { "sessionId": "..." } (opcional si se envía Bearer token)
 */
export async function logout(ctx: Context): Promise<void> {
  try {
    // deno-lint-ignore no-explicit-any
    let body: Record<string, any> = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      // Body may be empty if sessionId is in token
    }

    let sessionId = body?.sessionId;

    if (!sessionId) {
      const payload = await extractPayloadFromHeader(ctx);
      if (payload && payload.sessionId) {
        sessionId = String(payload.sessionId);
      }

      const claims = ctx.state.auth as { sub?: string; sessionId?: string; role?: string } | undefined;
      if (claims && claims.sessionId !== sessionId &&
        claims.role !== "director" && claims.role !== "control") {
        ctx.response.status = 403;
        ctx.response.body = { error: "No puede cerrar una sesión ajena" };
        return;
      }
    }

    if (!sessionId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Se requiere 'sessionId' en el cuerpo o un Bearer Token válido" };
      return;
    }

    const closed = await closeSession(sessionId, "Cierre de sesión manual");

    if (!closed) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Sesión no encontrada o ya finalizada" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = serialize({
      message: "Sesión cerrada exitosamente",
      sessionId: closed.sessionId,
      inicioConexion: closed.inicioConexion,
      finalConexion: closed.finalConexion,
      tiempoConectado: closed.tiempoConectado,
      tiempoConectadoSegundos: closed.tiempoConectadoSegundos,
      dispositivo: closed.dispositivo,
    });
  } catch (err) {
    console.error("[logout]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor al cerrar sesión" };
  }
}

/**
 * GET /auth/sessions/me
 * Obtiene las sesiones del usuario actual a través de su Bearer token.
 */
export async function getMySessions(ctx: Context): Promise<void> {
  try {
    const payload = await extractPayloadFromHeader(ctx);
    if (!payload || !payload.sub) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token no válido o no proporcionado" };
      return;
    }

    const userId = String(payload.sub);
    const data = await getUserSessions(userId);

    ctx.response.status = 200;
    ctx.response.body = serialize(data);
  } catch (err) {
    console.error("[getMySessions]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno al consultar sesiones" };
  }
}

/**
 * GET /auth/sessions/user/:id
 * Consulta de sesiones y alertas para roles de administración/control/docente.
 */
export async function getUserSessionsById(
  ctx: RouterContext<"/auth/sessions/user/:id">,
): Promise<void> {
  try {
    const userId = ctx.params.id;
    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El parámetro :id es obligatorio" };
      return;
    }

    const data = await getUserSessions(userId);

    ctx.response.status = 200;
    ctx.response.body = serialize(data);
  } catch (err) {
    console.error("[getUserSessionsById]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno al consultar sesiones del usuario" };
  }
}

/**
 * DELETE /auth/sessions/:sessionId
 * Invalida/cierra remotamente una sesión específica.
 */
export async function revokeSession(
  ctx: RouterContext<"/auth/sessions/:sessionId">,
): Promise<void> {
  try {
    const sessionId = ctx.params.sessionId;
    if (!sessionId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El parámetro :sessionId es obligatorio" };
      return;
    }

    const closed = await closeSession(sessionId, "Sesión revocada remotamente");

    if (!closed) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Sesión no encontrada o ya finalizada" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = serialize({
      message: "Sesión revocada correctamente",
      sessionId: closed.sessionId,
      tiempoConectado: closed.tiempoConectado,
      finalConexion: closed.finalConexion,
    });
  } catch (err) {
    console.error("[revokeSession]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error al revocar la sesión" };
  }
}
