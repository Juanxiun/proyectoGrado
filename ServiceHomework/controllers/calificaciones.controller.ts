import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as calificacionService from "../services/calificacion.service.ts";
import type {
  BulkCalificacionInput,
  CreateCalificacionInput,
  UpdateCalificacionInput,
} from "../models/homework.ts";

export async function listCalificaciones(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await calificacionService.listCalificaciones(parsePagination(params), {
      encargoId: params.get("encargoId") ?? undefined,
      estudianteId: params.get("estudianteId") ?? undefined,
      asignacionId: params.get("asignacionId") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar calificaciones");
  }
}

export async function getCalificacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await calificacionService.getCalificacionById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener calificación");
  }
}

export async function createCalificacion(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateCalificacionInput>(ctx);
    respond(ctx, 201, await calificacionService.createCalificacion(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al registrar calificación");
  }
}

export async function updateCalificacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateCalificacionInput>(ctx);
    respond(ctx, 200, await calificacionService.updateCalificacion(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar calificación");
  }
}

export async function deleteCalificacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await calificacionService.deleteCalificacion(id);
    respond(ctx, 200, { message: `Calificación id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar calificación");
  }
}

export async function bulkCalificaciones(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<BulkCalificacionInput>(ctx);
    respond(ctx, 200, await calificacionService.saveBulkCalificaciones(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al guardar calificaciones por lote");
  }
}
