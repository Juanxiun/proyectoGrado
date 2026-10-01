import { Context } from "@oak/oak";
import { dashboardCompleto } from "../services/dashboard.service.ts";
import { resumenAcademico } from "../services/academico.service.ts";
import { resumenAsistencia } from "../services/asistencia.service.ts";
import { resumenEconomico } from "../services/economico.service.ts";
import { resumenRiesgo, obtenerUmbrales } from "../services/riesgo.service.ts";
import { invalidarDashboard } from "../services/cache.service.ts";
import { resolverContexto, resolverPeriodo } from "../services/alcance.service.ts";
import { query } from "../connects/Database/transaction.ts";
import { ROLES_INSTITUCION, requireAuth, type AuthClaims } from "../security/auth.ts";
import { HttpError } from "../utils/errors.ts";
import { handleControllerError, respond } from "../utils/http.ts";

/**
 * Vistas del tablero. Todas exigen JWT y recortan por rol: el alcance se
 * resuelve en el servidor, nunca a pedido del cliente.
 */

/** Nombres de las vistas que el gateway puede pedir por webhook. */
export const eventosRegistrados = (): string[] => [
  "dashboard.get",
  "dashboard.academico",
  "dashboard.asistencia",
  "dashboard.riesgo",
  "dashboard.economico",
  "dashboard.periodos",
  "dashboard.umbrales",
  "dashboard.cache.invalidate",
];

function claims(ctx: Context): AuthClaims {
  const auth = ctx.state.auth as AuthClaims | undefined;
  if (!auth) throw new HttpError(401, "No autenticado");
  return auth;
}

function trimestreDe(ctx: Context): number {
  const valor = Number(ctx.request.url.searchParams.get("trimestre") ?? 1);
  return valor >= 1 && valor <= 3 ? valor : 1;
}

function periodoDe(ctx: Context): string | null {
  return ctx.request.url.searchParams.get("periodoId") ?? null;
}

/** Rango del trimestre en curso, reutilizado por los bloques sueltos. */
async function rango(contexto: Awaited<ReturnType<typeof resolverContexto>>) {
  const periodoId = contexto.periodo?.id ?? "";
  if (!periodoId) return { desde: "1900-01-01", hasta: "2999-12-31" };

  const res = await query<{ inicio: Date; fin: Date }>(
    `SELECT inicio, fin FROM trimestres WHERE periodo_id = $1 AND numero = $2`,
    [periodoId, contexto.periodo?.trimestre ?? 1],
  );
  if (res.rows.length > 0) {
    return {
      desde: res.rows[0].inicio.toISOString().slice(0, 10),
      hasta: res.rows[0].fin.toISOString().slice(0, 10),
    };
  }

  const periodo = await query<{ inicio_gestion: Date; fin_gestion: Date }>(
    `SELECT inicio_gestion, fin_gestion FROM periodos_academicos WHERE id = $1`,
    [periodoId],
  );
  return periodo.rows.length > 0
    ? {
      desde: periodo.rows[0].inicio_gestion.toISOString().slice(0, 10),
      hasta: periodo.rows[0].fin_gestion.toISOString().slice(0, 10),
    }
    : { desde: "1900-01-01", hasta: "2999-12-31" };
}

/** GET /dashboard — todo junto, para la página de inicio. */
export async function getDashboard(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    const datos = await dashboardCompleto(
      auth.sub,
      auth.role,
      periodoDe(ctx),
      trimestreDe(ctx),
    );
    respond(ctx, 200, datos);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al construir el tablero");
  }
}

/** GET /dashboard/academico */
export async function getAcademico(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    const contexto = await resolverContexto(auth.sub, auth.role, periodoDe(ctx), trimestreDe(ctx));
    respond(ctx, 200, await resumenAcademico(contexto, trimestreDe(ctx)));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el avance académico");
  }
}

/** GET /dashboard/asistencia */
export async function getAsistencia(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    const contexto = await resolverContexto(auth.sub, auth.role, periodoDe(ctx), trimestreDe(ctx));
    const { desde, hasta } = await rango(contexto);
    respond(ctx, 200, await resumenAsistencia(contexto, desde, hasta));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la asistencia");
  }
}

/** GET /dashboard/riesgo */
export async function getRiesgo(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    const contexto = await resolverContexto(auth.sub, auth.role, periodoDe(ctx), trimestreDe(ctx));
    const { desde, hasta } = await rango(contexto);
    respond(ctx, 200, await resumenRiesgo(contexto, desde, hasta));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el riesgo");
  }
}

/** GET /dashboard/economico — sólo dirección y control. */
export async function getEconomico(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    if (!ROLES_INSTITUCION.includes(auth.role)) {
      throw new HttpError(403, "La estimación económica es sólo para dirección y control");
    }

    const periodo = await resolverPeriodo(periodoDe(ctx), trimestreDe(ctx));
    respond(ctx, 200, await resumenEconomico(periodo?.id ?? ""));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la estimación económica");
  }
}

/** GET /dashboard/periodos — para los selectores de la interfaz. */
export async function getPeriodos(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    const contexto = await resolverContexto(auth.sub, auth.role, null, trimestreDe(ctx));
    const academico = await resumenAcademico(contexto, trimestreDe(ctx));
    respond(ctx, 200, { periodos: academico.periodos, actual: contexto.periodo });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener los períodos");
  }
}

/** GET /dashboard/umbrales — criterio de riesgo vigente, sin depender de otro servicio. */
export async function getUmbralesRiesgo(ctx: Context): Promise<void> {
  try {
    respond(ctx, 200, await obtenerUmbrales());
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener los umbrales");
  }
}

/** POST /dashboard/cache/invalidar — fuerza el recálculo tras un cambio puntual. */
export async function postInvalidarCache(ctx: Context): Promise<void> {
  try {
    const auth = claims(ctx);
    if (!ROLES_INSTITUCION.includes(auth.role)) {
      throw new HttpError(403, "Sólo dirección y control pueden invalidar la caché");
    }
    respond(ctx, 200, { success: true, clavesEliminadas: await invalidarDashboard() });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al invalidar la caché");
  }
}
