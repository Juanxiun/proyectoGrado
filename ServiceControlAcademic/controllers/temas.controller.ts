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
  listTemas,
  getTemaById,
  createTema,
  updateTema,
  deleteTema,
  getProgresoEstudianteTema,
  getTemasMateria,
  getTemasPorUnidad,
  getTemasEvaluacion,
} from "../services/temas.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function listTemasController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const filters: any = {};
    if (params.has("materiaId")) filters.materiaId = params.get("materiaId");
    if (params.has("unidad")) filters.unidad = Number(params.get("unidad"));
    if (params.has("activo")) filters.activo = params.get("activo") === "true";
    const result = await listTemas(pagination, filters);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar temas");
  }
}

export async function getTemaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    respond(ctx, 200, await getTemaById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener tema");
  }
}

export async function createTemaController(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<any>(ctx);
    const created = await createTema(body);
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error al crear tema");
  }
}

export async function updateTemaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<any>(ctx);
    respond(ctx, 200, await updateTema(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al actualizar tema");
  }
}

export async function deleteTemaController(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    await deleteTema(id);
    respond(ctx, 200, { message: `Tema id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error al eliminar tema");
  }
}

export async function getProgresoEstudianteTemaController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const estudianteId = params.get("estudianteId");
    const materiaId = params.get("materiaId");
    if (!estudianteId || !materiaId) throw new HttpError(400, "estudianteId y materiaId requeridos");
    const result = await getProgresoEstudianteTema(estudianteId, materiaId);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener progreso de temas");
  }
}

export async function getTemasMateriaController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    if (!materiaId) throw new HttpError(400, "materiaId requerido");
    const temas = await getTemasMateria(materiaId);
    respond(ctx, 200, temas);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener temas de materia");
  }
}

export async function getTemasPorUnidadController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    const unidad = params.get("unidad");
    if (!materiaId || !unidad) throw new HttpError(400, "materiaId y unidad requeridos");
    const temas = await getTemasPorUnidad(materiaId, Number(unidad));
    respond(ctx, 200, temas);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener temas por unidad");
  }
}

export async function getTemasEvaluacionController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    if (!materiaId) throw new HttpError(400, "materiaId requerido");
    const temas = await getTemasEvaluacion(materiaId);
    respond(ctx, 200, temas);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener temas de evaluación");
  }
}

function routeParam(ctx: Context, name: string): string | null {
  // deno-lint-ignore no-explicit-any
  return (ctx as any).params?.[name] ?? null;
}

export const routes = [
  { method: "GET", path: "/temas", handler: listTemasController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/temas/:id", handler: getTemaController, middleware: [requireControlAcademico()] },
  { method: "POST", path: "/temas", handler: createTemaController, middleware: [requireDocente()] },
  { method: "PUT", path: "/temas/:id", handler: updateTemaController, middleware: [requireDocente()] },
  { method: "DELETE", path: "/temas/:id", handler: deleteTemaController, middleware: [requireDocente()] },
  { method: "GET", path: "/temas/progreso/estudiante", handler: getProgresoEstudianteTemaController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/temas/materia", handler: getTemasMateriaController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/temas/unidad", handler: getTemasPorUnidadController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/temas/evaluacion", handler: getTemasEvaluacionController, middleware: [requireControlAcademico()] },
];