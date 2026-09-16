import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import * as materiaService from "../../services/materia.service.ts";
import type { CreateMateriaInput, UpdateMateriaInput } from "../../models/academic.ts";

export async function listMaterias(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await materiaService.listMaterias(parsePagination(params), {
      activo: params.get("activo") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar materias");
  }
}

export async function getMateria(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await materiaService.getMateriaById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la materia");
  }
}

export async function createMateria(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateMateriaInput>(ctx);
    respond(ctx, 201, await materiaService.createMateria(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear la materia");
  }
}

export async function updateMateria(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateMateriaInput>(ctx);
    respond(ctx, 200, await materiaService.updateMateria(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar la materia");
  }
}

export async function deleteMateria(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await materiaService.deleteMateria(id);
    respond(ctx, 200, { message: `Materia id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la materia");
  }
}
