import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as asignacionService from "../services/asignacion.service.ts";
import type { CreateAsignacionInput, UpdateAsignacionInput } from "../models/enrollment.ts";

export async function listAsignaciones(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await asignacionService.listAsignaciones(parsePagination(params), {
      maestroId: params.get("maestroId") ?? undefined,
      materiaId: params.get("materiaId") ?? undefined,
      cursoPeriodoId: params.get("cursoPeriodoId") ?? undefined,
      periodoId: params.get("periodoId") ?? undefined,
      estado: params.get("estado") ?? undefined,
      viewerUserId: String(ctx.state.auth?.sub ?? ""),
      viewerRole: String(ctx.state.auth?.role ?? ""),
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar asignaciones docentes");
  }
}

export async function getAsignacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await asignacionService.getAsignacionById(
      id,
      String(ctx.state.auth?.sub ?? ""),
      String(ctx.state.auth?.role ?? ""),
    ));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener asignación docente");
  }
}

export async function createAsignacion(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateAsignacionInput>(ctx);
    respond(ctx, 201, await asignacionService.createAsignacion(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al asignar materia/carga horaria a docente");
  }
}

export async function updateAsignacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateAsignacionInput>(ctx);
    respond(ctx, 200, await asignacionService.updateAsignacion(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar la asignación docente");
  }
}

export async function deleteAsignacion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await asignacionService.deleteAsignacion(id);
    respond(ctx, 200, { message: `Asignación docente id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la asignación docente");
  }
}
