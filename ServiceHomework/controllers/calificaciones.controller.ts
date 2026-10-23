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
import { publicarEventoAsync } from "../utils/events.ts";

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
    const created = await calificacionService.createCalificacion(body);
    publicarEventoAsync("calificaciones.create", {
      estudianteId: created.estudianteId,
      nota: created.nota,
      titulo: created.encargo?.titulo,
      itemId: created.id,
      // evento -> reevaluar riesgo estudiante
      evaluacionRiesgo: true,
    });
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al registrar calificación");
  }
}

export async function updateCalificacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateCalificacionInput>(ctx);
    const updated = await calificacionService.updateCalificacion(id, body);
    publicarEventoAsync("calificaciones.update", {
      estudianteId: updated.estudianteId,
      nota: updated.nota,
      titulo: updated.encargo?.titulo,
      itemId: id,
      evaluacionRiesgo: true,
    });
    respond(ctx, 200, updated);
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
    const result = await calificacionService.saveBulkCalificaciones(body);
    publicarEventoAsync("calificaciones.bulk", {
      encargoId: body.encargoId,
      total: result.totalGuardados,
      evaluacionRiesgo: true,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al guardar calificaciones por lote");
  }
}
