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
import { publicarEventoAsync } from "../../utils/events.ts";

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
    const created = await materiaService.createMateria(body);
    publicarEventoAsync("materias.create", { id: created.id, nombre: created.nombre, codigo: created.codigo });
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear la materia");
  }
}

export async function updateMateria(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateMateriaInput>(ctx);
    const updated = await materiaService.updateMateria(id, body);
    publicarEventoAsync("materias.update", { id, nombre: updated.nombre, codigo: updated.codigo });
    respond(ctx, 200, updated);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar la materia");
  }
}

export async function deleteMateria(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const previa = await materiaService.getMateriaById(id);
    await materiaService.deleteMateria(id);
    publicarEventoAsync("materias.delete", { id, nombre: previa?.nombre });
    respond(ctx, 200, { message: `Materia id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la materia");
  }
}
