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
  listAsistencias,
  getAsistenciaById,
  createAsistencia,
  updateAsistencia,
  deleteAsistencia,
  saveBulkAsistencias,
  getReporteAsistenciaCurso,
  getAsistenciaEstudianteMateria,
} from "../services/asistencia.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function listAsistenciasController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const filters: any = {};
    if (params.has("asignacionId")) filters.asignacionId = params.get("asignacionId");
    if (params.has("estudianteId")) filters.estudianteId = params.get("estudianteId");
    if (params.has("materiaId")) filters.materiaId = params.get("materiaId");
    if (params.has("cursoPeriodoId")) filters.cursoPeriodoId = params.get("cursoPeriodoId");
    if (params.has("fechaDesde")) filters.fechaDesde = params.get("fechaDesde");
    if (params.has("fechaHasta")) filters.fechaHasta = params.get("fechaHasta");
    if (params.has("estado")) filters.estado = params.get("estado");
    const result = await listAsistencias(pagination, filters);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar asistencia");
  }
}

export async function getAsistenciaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    respond(ctx, 200, await getAsistenciaById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener asistencia");
  }
}

export async function createAsistenciaController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const created = await createAsistencia(body);
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error al registrar asistencia");
  }
}

export async function updateAsistenciaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<any>(ctx);
    respond(ctx, 200, await updateAsistencia(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al actualizar asistencia");
  }
}

export async function deleteAsistenciaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    await deleteAsistencia(id);
    respond(ctx, 200, { message: `Asistencia id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error al eliminar asistencia");
  }
}

export async function bulkAsistenciasController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const result = await saveBulkAsistencias(body);
    respond(ctx, 201, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al guardar asistencia masiva");
  }
}

export async function getReporteAsistenciaController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const cursoPeriodoId = params.get("cursoPeriodoId");
    const materiaId = params.get("materiaId");
    if (!cursoPeriodoId || !materiaId) throw new HttpError(400, "cursoPeriodoId y materiaId requeridos");
    const reporte = await getReporteAsistenciaCurso(cursoPeriodoId, materiaId);
    respond(ctx, 200, reporte);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar reporte de asistencia");
  }
}

export async function getAsistenciaEstudianteController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const estudianteId = params.get("estudianteId");
    const materiaId = params.get("materiaId");
    const fechaDesde = params.get("fechaDesde");
    const fechaHasta = params.get("fechaHasta");
    if (!estudianteId || !materiaId) throw new HttpError(400, "estudianteId y materiaId requeridos");
    const result = await getAsistenciaEstudianteMateria(estudianteId, materiaId, fechaDesde ?? undefined, fechaHasta ?? undefined);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener asistencia del estudiante");
  }
}

function routeParam(ctx: Context, name: string): string | null {
  // deno-lint-ignore no-explicit-any
  return (ctx as any).params?.[name] ?? null;
}

export const routes = [
  { method: "GET", path: "/asistencia", handler: listAsistenciasController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/asistencia/:id", handler: getAsistenciaController, middleware: [requireControlAcademico()] },
  { method: "POST", path: "/asistencia", handler: createAsistenciaController, middleware: [requireDocente()] },
  { method: "POST", path: "/asistencia/bulk", handler: bulkAsistenciasController, middleware: [requireDocente()] },
  { method: "PUT", path: "/asistencia/:id", handler: updateAsistenciaController, middleware: [requireDocente()] },
  { method: "DELETE", path: "/asistencia/:id", handler: deleteAsistenciaController, middleware: [requireDocente()] },
  { method: "GET", path: "/asistencia/reporte/curso", handler: getReporteAsistenciaController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/asistencia/estudiante", handler: getAsistenciaEstudianteController, middleware: [requireControlAcademico()] },
];