import { Context } from "@oak/oak";
import { HttpError } from "../utils/errors.ts";
import { parseNumericId, respond, routeParam } from "../utils/http.ts";
import type { AuthClaims } from "../security/auth.ts";
import {
  actualizarPreguntaEstado,
  aprobarEvaluacionTrimestral,
  eliminarEvaluacionTrimestral,
  getContextoEvaluacionTrimestral,
  getEvaluacionTrimestralById,
  iniciarGeneracionTrimestral,
  listEvaluacionesTrimestrales,
  obtenerPdfEvaluacionTrimestral,
  regenerarPreguntaUnica,
} from "../services/evaluacionTrimestral.service.ts";

function getClaims(ctx: Context): AuthClaims {
  return ctx.state.auth as AuthClaims;
}

function handleError(ctx: Context, err: unknown): void {
  if (err instanceof HttpError) {
    respond(ctx, err.status, { error: err.message });
    return;
  }
  console.error("[EvaluacionTrimestral]", err);
  respond(ctx, 500, { error: "Ocurrió un error procesando la evaluación trimestral." });
}

export async function getContextoTrimestral(ctx: Context): Promise<void> {
  try {
    const asignacionParam = ctx.request.url.searchParams.get("asignacionId");
    const asignacionId = parseNumericId(asignacionParam, "asignacionId");
    const data = await getContextoEvaluacionTrimestral(asignacionId);
    respond(ctx, 200, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function listarTrimestrales(ctx: Context): Promise<void> {
  try {
    const asignacionParam = ctx.request.url.searchParams.get("asignacionId");
    const asignacionId = asignacionParam ? parseNumericId(asignacionParam, "asignacionId") : undefined;
    const data = await listEvaluacionesTrimestrales(asignacionId);
    respond(ctx, 200, { data });
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function obtenerTrimestral(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    const data = await getEvaluacionTrimestralById(id);
    respond(ctx, 200, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function generarTrimestral(ctx: Context): Promise<void> {
  try {
    const body = await ctx.request.body.json().catch(() => ({}));
    const usuarioId = Number(getClaims(ctx).sub);
    const data = await iniciarGeneracionTrimestral(body, usuarioId);
    respond(ctx, 202, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function actualizarEstadoPregunta(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    const preguntaId = routeParam(ctx, "preguntaId") ?? "";
    const body = await ctx.request.body.json().catch(() => ({}));
    const estado = body.estado;
    if (!["aprobada", "rechazada", "pendiente"].includes(estado)) {
      throw new HttpError(400, "Estado de pregunta inválido.");
    }
    const data = await actualizarPreguntaEstado(id, preguntaId, estado, body.comentario);
    respond(ctx, 200, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function regenerarPregunta(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    const preguntaId = routeParam(ctx, "preguntaId") ?? "";
    const body = await ctx.request.body.json().catch(() => ({}));
    const indicaciones = String(body.indicaciones ?? body.comentario ?? "");
    const data = await regenerarPreguntaUnica(id, preguntaId, indicaciones);
    respond(ctx, 200, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function aprobarTrimestral(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    const data = await aprobarEvaluacionTrimestral(id);
    respond(ctx, 200, data);
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function descargarPdfTrimestral(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    const download = ctx.request.url.searchParams.get("download") === "1";
    const { bytes, fileName } = await obtenerPdfEvaluacionTrimestral(id);
    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/pdf");
    ctx.response.headers.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${fileName}"`,
    );
    ctx.response.headers.set("Cache-Control", "private, no-store");
    ctx.response.body = bytes;
  } catch (err) {
    handleError(ctx, err);
  }
}

export async function borrarTrimestral(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"), "id");
    await eliminarEvaluacionTrimestral(id);
    respond(ctx, 200, { ok: true });
  } catch (err) {
    handleError(ctx, err);
  }
}
