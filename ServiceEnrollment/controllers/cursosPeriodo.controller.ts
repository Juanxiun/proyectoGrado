import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as cursoPeriodoService from "../services/cursoPeriodo.service.ts";
import type { CreateCursoPeriodoInput, UpdateCursoPeriodoInput } from "../models/enrollment.ts";

export async function listCursosPeriodo(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await cursoPeriodoService.listCursosPeriodo(parsePagination(params), {
      cursoId: params.get("cursoId") ?? undefined,
      periodoId: params.get("periodoId") ?? undefined,
      anio: params.get("anio") ?? undefined,
      estado: params.get("estado") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar cursos del periodo");
  }
}

export async function getCursoPeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await cursoPeriodoService.getCursoPeriodoById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener curso del periodo");
  }
}

export async function createCursoPeriodo(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateCursoPeriodoInput>(ctx);
    respond(ctx, 201, await cursoPeriodoService.createCursoPeriodo(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear curso del periodo");
  }
}

export async function updateCursoPeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateCursoPeriodoInput>(ctx);
    respond(ctx, 200, await cursoPeriodoService.updateCursoPeriodo(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar curso del periodo");
  }
}

export async function deleteCursoPeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await cursoPeriodoService.deleteCursoPeriodo(id);
    respond(ctx, 200, { message: `Curso del periodo id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar curso del periodo");
  }
}
