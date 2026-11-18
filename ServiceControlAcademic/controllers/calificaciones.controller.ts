import { Context } from "@oak/oak";
import {
  handleControllerError,
  parsePagination,
  parseNumericId,
  respond,
  readJsonBody,
} from "../utils/http.ts";
import { requireDocente, requireControlAcademico } from "../security/auth.ts";
import {
  listCalificaciones,
  getCalificacionById,
  createCalificacion,
  updateCalificacion,
  saveBulkCalificaciones,
  getReporteCalificacionesMateria,
} from "../services/calificaciones.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function listCalificacionesController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const filters: any = {};
    if (params.has("asignacionId")) filters.asignacionId = params.get("asignacionId");
    if (params.has("estudianteId")) filters.estudianteId = params.get("estudianteId");
    if (params.has("materiaId")) filters.materiaId = params.get("materiaId");
    if (params.has("cursoPeriodoId")) filters.cursoPeriodoId = params.get("cursoPeriodoId");
    if (params.has("trimestre")) filters.trimestre = params.get("trimestre");
    if (params.has("tipoEvaluacion")) filters.tipoEvaluacion = params.get("tipoEvaluacion");
    const result = await listCalificaciones(pagination, filters);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar calificaciones");
  }
}

export async function getCalificacionController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    respond(ctx, 200, await getCalificacionById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener calificación");
  }
}

export async function createCalificacionController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const created = await createCalificacion(body);
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error al crear calificación");
  }
}

export async function updateCalificacionController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<any>(ctx);
    respond(ctx, 200, await updateCalificacion(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al actualizar calificación");
  }
}

export async function bulkCalificacionesController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const result = await saveBulkCalificaciones(body);
    respond(ctx, 201, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al guardar calificaciones masivas");
  }
}

export async function getReporteCalificacionesController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    const cursoPeriodoId = params.get("cursoPeriodoId");
    const trimestre = params.get("trimestre");
    if (!materiaId || !cursoPeriodoId || !trimestre) throw new HttpError(400, "materiaId, cursoPeriodoId y trimestre requeridos");
    const reporte = await getReporteCalificacionesMateria(materiaId, cursoPeriodoId, Number(trimestre));
    respond(ctx, 200, reporte);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar reporte de calificaciones");
  }
}

function routeParam(ctx: Context, name: string): string | null {
  // deno-lint-ignore no-explicit-any
  return (ctx as any).params?.[name] ?? null;
}

export const routes = [
  { method: "GET", path: "/calificaciones", handler: listCalificacionesController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/calificaciones/:id", handler: getCalificacionController, middleware: [requireControlAcademico()] },
  { method: "POST", path: "/calificaciones", handler: createCalificacionController, middleware: [requireDocente()] },
  { method: "POST", path: "/calificaciones/bulk", handler: bulkCalificacionesController, middleware: [requireDocente()] },
  { method: "PUT", path: "/calificaciones/:id", handler: updateCalificacionController, middleware: [requireDocente()] },
  { method: "GET", path: "/calificaciones/reporte/materia", handler: getReporteCalificacionesController, middleware: [requireControlAcademico()] },
];