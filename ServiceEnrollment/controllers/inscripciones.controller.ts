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
import {
  aprobarSolicitud,
  crearSolicitud,
  listarSolicitudes,
  rechazarSolicitud,
} from "../services/solicitudInscripcion.service.ts";
import type {
  CreateInscripcionInput,
  CreateSolicitudInscripcionInput,
  UpdateInscripcionInput,
} from "../models/enrollment.ts";

export async function listInscripciones(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await inscripcionService.listInscripciones(parsePagination(params), {
      estudianteId: params.get("estudianteId") ?? undefined,
      cursoPeriodoId: params.get("cursoPeriodoId") ?? undefined,
      periodoId: params.get("periodoId") ?? undefined,
      estado: params.get("estado") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
      viewerUserId: String(ctx.state.auth?.sub ?? ""),
      viewerRole: String(ctx.state.auth?.role ?? ""),
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar inscripciones");
  }
}

export async function getInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await inscripcionService.getInscripcionById(
      id,
      String(ctx.state.auth?.sub ?? ""),
      String(ctx.state.auth?.role ?? ""),
    ));
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

export async function enableInscripcion(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<{ cursoPeriodoId?: string | number }>(ctx);
    const cursoPeriodoId = String(body.cursoPeriodoId ?? "").trim();
    respond(ctx, 201, await inscripcionService.habilitarInscripcion(String(ctx.state.auth?.sub ?? ""), cursoPeriodoId));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al habilitar la inscripción");
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
    const body = await readJsonBody<{ observacion?: string; fechaRetiro?: string }>(ctx).catch(() => ({ observacion: undefined as string | undefined, fechaRetiro: undefined as string | undefined }));
    respond(
      ctx,
      200,
      await inscripcionService.updateInscripcion(id, {
        estado: "retirado",
        fechaRetiro: body.fechaRetiro,
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

export async function createSolicitudInscripcion(ctx: Context): Promise<void> {
  try {
    const userId = String(ctx.state.auth?.sub ?? "");
    const body = await readJsonBody<CreateSolicitudInscripcionInput>(ctx);
    respond(ctx, 201, await crearSolicitud(userId, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al solicitar inscripción");
  }
}

export async function listSolicitudesInscripcion(ctx: Context): Promise<void> {
  try {
    const userId = String(ctx.state.auth?.sub ?? "");
    const management = ["director", "control"].includes(String(ctx.state.auth?.role ?? ""));
    respond(ctx, 200, await listarSolicitudes(userId, management));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar solicitudes de inscripción");
  }
}

export async function approveSolicitudInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const reviewerId = String(ctx.state.auth?.sub ?? "");
    respond(ctx, 200, await aprobarSolicitud(id, reviewerId));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al aprobar la inscripción");
  }
}

export async function rejectSolicitudInscripcion(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const reviewerId = String(ctx.state.auth?.sub ?? "");
    const body = await readJsonBody<{ observacion?: string }>(ctx).catch((): { observacion?: string } => ({}));
    respond(ctx, 200, await rechazarSolicitud(id, reviewerId, body.observacion));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al rechazar la inscripción");
  }
}
