import { Context } from "@oak/oak";
import { SignJWT } from "jose";
import { jwtConfig } from "../../config/jwt.config.ts";
import { serialize } from "../../utils/serialize.ts";
import {
  extractDeviceInfo,
  extractLocationInfo,
} from "../../utils/deviceDetector.ts";
import {
  verify2FACode,
  resend2FACode,
} from "../../services/twoFactor.service.ts";
import { createSession } from "../../services/session.service.ts";

let _jwtSecretKey: Uint8Array | null = null;
function getSecretKey(): Uint8Array {
  if (!_jwtSecretKey) {
    _jwtSecretKey = new TextEncoder().encode(jwtConfig.secret);
  }
  return _jwtSecretKey;
}

/**
 * POST /auth/verify-2fa
 *
 * Body:
 * {
 *   "tempToken": "uuid-temporal",
 *   "code": "123456",
 *   "lat": -16.500,     // opcional
 *   "lon": -68.150,     // opcional
 *   "zona": "Sopocachi" // opcional
 * }
 */
export async function verify2FA(ctx: Context): Promise<void> {
  try {
    const body = await ctx.request.body.json();
    const { tempToken, code } = body ?? {};

    if (!tempToken || !code) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Los campos 'tempToken' y 'code' (código 2FA) son obligatorios",
      };
      return;
    }

    const verification = await verify2FACode(tempToken, code);

    if (!verification.success || !verification.sessionData) {
      ctx.response.status = 400;
      ctx.response.body = { error: verification.error ?? "Código 2FA incorrecto o expirado" };
      return;
    }

    const sData = verification.sessionData;

    // Extraer dispositivo y geolocalización actualizada del request
    const deviceInfo = extractDeviceInfo(ctx);
    const locationInfo = extractLocationInfo(ctx, body);

    // Crear sesión en Redis con reglas de concurrencia y detección de trampas
    const { session, closedPreviousSessions } = await createSession({
      usuarioId: sData.userId,
      username: sData.username,
      rol: sData.rol,
      deviceInfo,
      locationInfo: locationInfo.lat || locationInfo.zona ? locationInfo : sData.locationInfo,
    });

    const payload = {
      sub: String(sData.userId),
      username: sData.username,
      rol: sData.rol,
      role: ["maestro", "maestros", "docente"].includes(sData.rol.toLowerCase())
        ? "profesor"
        : sData.rol.toLowerCase(),
      roles: [["maestro", "maestros", "docente"].includes(sData.rol.toLowerCase())
        ? "profesor"
        : sData.rol.toLowerCase()],
      rolId: String(sData.rolId),
      sessionId: session.sessionId,
      ...sData.extraInfo,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(jwtConfig.expiresIn)
      .sign(getSecretKey());

    ctx.response.status = 200;
    ctx.response.body = serialize({
      token,
      sessionId: session.sessionId,
      usuario: {
        id: sData.userId,
        username: sData.username,
        email: sData.email,
        nombre: sData.nombre,
        apellidoPaterno: sData.apellidoPaterno,
        apellidoMaterno: sData.apellidoMaterno,
        fotoUrl: sData.fotoUrl,
        rol: sData.rol,
        rolId: sData.rolId,
        ...sData.extraInfo,
      },
      session: {
        sessionId: session.sessionId,
        inicioConexion: session.inicioConexion,
        dispositivo: session.dispositivo,
        ubicacion: session.ubicacion,
        activo: session.activo,
        posibleTrampa: session.posibleTrampa,
        alertaTrampa: session.alertaTrampa,
      },
      sesionesPreviasCerradas: closedPreviousSessions.length > 0 ? closedPreviousSessions : undefined,
    });
  } catch (err) {
    console.error("[verify2FA]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor al verificar 2FA" };
  }
}

/**
 * POST /auth/resend-2fa
 *
 * Body:
 * {
 *   "tempToken": "uuid-temporal"
 * }
 */
export async function resend2FA(ctx: Context): Promise<void> {
  try {
    const body = await ctx.request.body.json();
    const { tempToken } = body ?? {};

    if (!tempToken) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El campo 'tempToken' es obligatorio" };
      return;
    }

    const result = await resend2FACode(tempToken);

    if (!result.success) {
      ctx.response.status = 400;
      ctx.response.body = { error: result.error ?? "No se pudo reenviar el código" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Se ha enviado un nuevo código 2FA al correo registrado",
      emailMasked: result.emailMasked,
      expiresInSeconds: 300,
    };
  } catch (err) {
    console.error("[resend2FA]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor al reenviar 2FA" };
  }
}
