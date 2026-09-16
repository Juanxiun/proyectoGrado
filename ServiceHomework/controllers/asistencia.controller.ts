import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as asistenciaService from "../services/asistencia.service.ts";
import type {
  BulkAsistenciaInput,
  CreateAsistenciaInput,
  UpdateAsistenciaInput,
} from "../models/homework.ts";

export async function listAsistencias(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await asistenciaService.listAsistencias(parsePagination(params), {
      asignacionId: params.get("asignacionId") ?? undefined,
      estudianteId: params.get("estudianteId") ?? undefined,
      fecha: params.get("fecha") ?? undefined,
      estado: params.get("estado") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar asistencia");
  }
}

export async function getAsistencia(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await asistenciaService.getAsistenciaById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener asistencia");
  }
}

export async function createAsistencia(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateAsistenciaInput>(ctx);
    respond(ctx, 201, await asistenciaService.createAsistencia(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al registrar asistencia");
  }
}

export async function updateAsistencia(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateAsistenciaInput>(ctx);
    respond(ctx, 200, await asistenciaService.updateAsistencia(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar asistencia");
  }
}

export async function deleteAsistencia(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await asistenciaService.deleteAsistencia(id);
    respond(ctx, 200, { message: `Asistencia id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar asistencia");
  }
}

export async function bulkAsistencias(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<BulkAsistenciaInput>(ctx);
    respond(ctx, 200, await asistenciaService.saveBulkAsistencias(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al registrar asistencia por lote");
  }
}
