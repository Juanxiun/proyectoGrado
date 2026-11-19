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
  listExamenes,
  getExamenById,
  createExamen,
  updateExamen,
  deleteExamen,
  responderExamen,
  getResultadosExamen,
} from "../services/examenes.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function listExamenesController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const filters: any = {};
    if (params.has("materiaId")) filters.materiaId = params.get("materiaId");
    if (params.has("asignacionId")) filters.asignacionId = params.get("asignacionId");
    if (params.has("cursoPeriodoId")) filters.cursoPeriodoId = params.get("cursoPeriodoId");
    if (params.has("trimestre")) filters.trimestre = params.get("trimestre");
    if (params.has("estado")) filters.estado = params.get("estado");
    const result = await listExamenes(pagination, filters);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar exámenes");
  }
}

export async function getExamenController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    respond(ctx, 200, await getExamenById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener examen");
  }
}

export async function createExamenController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const created = await createExamen(body);
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error al crear examen");
  }
}

export async function updateExamenController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<any>(ctx);
    respond(ctx, 200, await updateExamen(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al actualizar examen");
  }
}

export async function deleteExamenController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    await deleteExamen(id);
    respond(ctx, 200, { message: `Examen id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error al eliminar examen");
  }
}

export async function responderExamenController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const result = await responderExamen(body);
    respond(ctx, 201, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al responder examen");
  }
}

export async function getResultadosExamenController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const resultados = await getResultadosExamen(id);
    respond(ctx, 200, resultados);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener resultados del examen");
  }
}

function routeParam(ctx: Context, name: string): string | null {
  // deno-lint-ignore no-explicit-any
  return (ctx as any).params?.[name] ?? null;
}

export const routes = [
  { method: "GET", path: "/examenes", handler: listExamenesController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/examenes/:id", handler: getExamenController, middleware: [requireControlAcademico()] },
  { method: "POST", path: "/examenes", handler: createExamenController, middleware: [requireDocente()] },
  { method: "PUT", path: "/examenes/:id", handler: updateExamenController, middleware: [requireDocente()] },
  { method: "DELETE", path: "/examenes/:id", handler: deleteExamenController, middleware: [requireDocente()] },
  { method: "POST", path: "/examenes/responder", handler: responderExamenController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/examenes/:id/resultados", handler: getResultadosExamenController, middleware: [requireControlAcademico()] },
];