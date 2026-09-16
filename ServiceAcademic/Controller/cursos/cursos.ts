import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import * as cursoService from "../../services/curso.service.ts";
import type { CreateCursoInput, UpdateCursoInput } from "../../models/academic.ts";

export async function listCursos(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await cursoService.listCursos(parsePagination(params), {
      nivel: params.get("nivel") ?? undefined,
      activo: params.get("activo") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar cursos");
  }
}

export async function getCurso(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await cursoService.getCursoById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el curso");
  }
}

export async function createCurso(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateCursoInput>(ctx);
    respond(ctx, 201, await cursoService.createCurso(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear el curso");
  }
}

export async function updateCurso(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateCursoInput>(ctx);
    respond(ctx, 200, await cursoService.updateCurso(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar el curso");
  }
}

export async function deleteCurso(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await cursoService.deleteCurso(id);
    respond(ctx, 200, { message: `Curso id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar el curso");
  }
}
