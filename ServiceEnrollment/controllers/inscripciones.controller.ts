import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as inscripcionService from "../services/inscripcion.service.ts";
import type { CreateInscripcionInput, UpdateInscripcionInput } from "../models/enrollment.ts";

export async function listInscripciones(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await inscripcionService.listInscripciones(parsePagination(params), {
      estudianteId: params.get("estudianteId") ?? undefined,
      cursoPeriodoId: params.get("cursoPeriodoId") ?? undefined,
      periodoId: params.get("periodoId") ?? undefined,
      estado: params.get("estado") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar inscripciones");
  }
}

export async function getInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await inscripcionService.getInscripcionById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la inscripción");
  }
}

export async function createInscripcion(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateInscripcionInput>(ctx);
    respond(ctx, 201, await inscripcionService.createInscripcion(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al matricular estudiante");
  }
}

export async function updateInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateInscripcionInput>(ctx);
    respond(ctx, 200, await inscripcionService.updateInscripcion(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar la inscripción");
  }
}

export async function retirarInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<{ observacion?: string }>(ctx).catch(() => ({ observacion: undefined as string | undefined }));
    respond(
      ctx,
      200,
      await inscripcionService.updateInscripcion(id, {
        estado: "retirado",
        observacion: body.observacion ?? "Retiro del curso solicitado",
      }),
    );
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al retirar al estudiante");
  }
}

export async function deleteInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await inscripcionService.deleteInscripcion(id);
    respond(ctx, 200, { message: `Inscripción id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la inscripción");
  }
}
