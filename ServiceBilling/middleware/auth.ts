import { Context, Next } from "@oak/oak";
import { jwtVerify, JWTPayload } from "jose";
import { jwtConfig } from "../config/jwt.config.ts";

const secret = new TextEncoder().encode(jwtConfig.secret);

export interface BillingAuthClaims extends JWTPayload {
  sub: string;
  sessionId: string;
  rol: string;
  role: "director" | "control" | "profesor" | "estudiante";
}

export async function getClaimsFromToken(token: string): Promise<BillingAuthClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const sessionId = String(payload.sessionId ?? "");
    const sub = String(payload.sub ?? "");
    const role = String(payload.role ?? "");
    if (!sub || !sessionId || !role) {
      return null;
    }
    return { ...payload, sub, sessionId, rol: role } as BillingAuthClaims;
  } catch {
    return null;
  }
}

export async function getClaims(ctx: Context): Promise<BillingAuthClaims | null> {
  const header = ctx.request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return getClaimsFromToken(header.slice(7).trim());
}

export function requireAuth(roles?: ("director" | "control" | "profesor" | "estudiante")[]) {
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

export const ROLES_DIRECTOR_CONTROL: ("director" | "control")[] = ["director", "control"];
export const ROLES_TODOS: ("director" | "control" | "profesor" | "estudiante")[] = [
  "director",
  "control",
  "profesor",
  "estudiante",
];
export const ROLES_SIN_PROFESOR: ("director" | "control" | "estudiante")[] = [
  "director",
  "control",
  "estudiante",
];