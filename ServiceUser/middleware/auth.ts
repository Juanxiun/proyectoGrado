import { Context, Next } from "@oak/oak";
import { jwtVerify, JWTPayload } from "jose";
import { jwtConfig } from "../config/jwt.config.ts";
import { isSessionValidAndActive } from "../services/session.service.ts";

const secret = new TextEncoder().encode(jwtConfig.secret);
/**
 * Roles operativos usados para autorizar acciones.
 * Gerencia comparte las facultades de Control y Padres las de Estudiante.
 */
export type AppRole = "director" | "profesor" | "estudiante" | "control";

export interface AuthClaims extends JWTPayload {
  sub: string;
  sessionId: string;
  rol: string;
  role: AppRole;
}

export function normalizeRole(value: unknown): AppRole | null {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "maestro" || role === "maestros" || role === "docente" || role === "profesor" || role === "profesores") return "profesor";
  if (role === "gerencia" || role === "secretaria" || role === "secretario" || role === "administrativo" || role === "editor") return "control";
  if (role === "admin" || role === "administrador" || role === "directores") return "director";
  if (role === "alumno" || role === "alumnos" || role === "estudiante" || role === "estudiantes") return "estudiante";
  if (role === "padre" || role === "padres" || role === "apoderado" || role === "tutor") return "estudiante";
  return ["director", "profesor", "estudiante", "control"].includes(role)
    ? role as AppRole
    : null;
}

export async function getClaims(ctx: Context): Promise<AuthClaims | null> {
  const header = ctx.request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return await getClaimsFromToken(header.slice(7).trim());
}

export function extractBearerToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith("bearer ") ? trimmed.slice(7).trim() : trimmed;
}

export async function getClaimsFromToken(token: string): Promise<AuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const sessionId = String(payload.sessionId ?? "");
    const sub = String(payload.sub ?? "");
    const role = normalizeRole(payload.role ?? payload.rol);
    if (!sub || !sessionId || !role || !(await isSessionValidAndActive(sessionId))) return null;
    return { ...payload, sub, sessionId, rol: String(payload.rol ?? role), role };
  } catch {
    return null;
  }
}

export function requireAuth(roles?: AppRole[]) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const claims = await getClaims(ctx);
    if (!claims) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token inválido, expirado o sesión inactiva" };
      return;
    }
    if (roles && !roles.includes(claims.role)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "No tiene permisos para esta operación" };
      return;
    }
    ctx.state.auth = claims;
    await next();
  };
}
