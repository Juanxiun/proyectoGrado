import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import * as periodoService from "../../services/periodo.service.ts";
import { getPeriodoDetalle } from "../../services/gestion.service.ts";
import type { CreatePeriodoInput, UpdatePeriodoInput } from "../../models/academic.ts";

export async function listPeriodos(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await periodoService.listPeriodos(parsePagination(params), {
      anio: params.get("anio") ?? undefined,
      activo: params.get("activo") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
      viewerRole: String(ctx.state.auth?.role ?? ""),
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar periodos");
  }
}

export async function getPeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const periodo = await getPeriodoDetalle(id);
    if (ctx.state.auth?.role === "estudiante" && (!periodo.activo || periodo.estado !== "activo")) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Gestión académica no encontrada" };
      return;
    }
    respond(ctx, 200, periodo);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el periodo");
  }
}

export async function createPeriodo(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreatePeriodoInput>(ctx);
    respond(ctx, 201, await periodoService.createPeriodo(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear el periodo");
  }
}

export async function updatePeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdatePeriodoInput>(ctx);
    respond(ctx, 200, await periodoService.updatePeriodo(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar el periodo");
  }
}

export async function deletePeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const result = await periodoService.deletePeriodo(id);
    respond(ctx, 200, { message: `Gestión ${result.nombre} eliminada correctamente`, ...result });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar el periodo");
  }
}
