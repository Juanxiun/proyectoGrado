import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as asesorService from "../services/asesor.service.ts";
import type { CreateCursoAsesorInput, UpdateCursoAsesorInput } from "../models/enrollment.ts";

export async function listAsesores(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await asesorService.listAsesores(parsePagination(params), {
      cursoPeriodoId: params.get("cursoPeriodoId") ?? undefined,
      maestroId: params.get("maestroId") ?? undefined,
      periodoId: params.get("periodoId") ?? undefined,
      viewerUserId: String(ctx.state.auth?.sub ?? ""),
      viewerRole: String(ctx.state.auth?.role ?? ""),
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar asesores de curso");
  }
}

export async function getAsesor(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await asesorService.getAsesorById(
      id,
      String(ctx.state.auth?.sub ?? ""),
      String(ctx.state.auth?.role ?? ""),
    ));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener asesor de curso");
  }
}

export async function createAsesor(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateCursoAsesorInput>(ctx);
    respond(ctx, 201, await asesorService.createAsesor(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al asignar asesor de curso");
  }
}

export async function updateAsesor(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateCursoAsesorInput>(ctx);
    respond(ctx, 200, await asesorService.updateAsesor(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar asesor de curso");
  }
}

export async function deleteAsesor(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await asesorService.deleteAsesor(id);
    respond(ctx, 200, { message: `Asesor de curso id=${id} removido` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al remover asesor de curso");
  }
}
