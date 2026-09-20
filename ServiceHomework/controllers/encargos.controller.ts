import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as encargoService from "../services/encargo.service.ts";
import type { CreateEncargoInput, UpdateEncargoInput } from "../models/homework.ts";

export async function listEncargos(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await encargoService.listEncargos(parsePagination(params), {
      asignacionId: params.get("asignacionId") ?? undefined,
      tipo: params.get("tipo") ?? undefined,
      estado: params.get("estado") ?? undefined,
      buscar: params.get("buscar") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar encargos");
  }
}

export async function getEncargo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await encargoService.getEncargoById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener encargo");
  }
}

import { createAndDispatchNotification } from "../services/notification.service.ts";

export async function createEncargo(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<CreateEncargoInput>(ctx);
    const created = await encargoService.createEncargo(body);
    createAndDispatchNotification({
      tipo: "actividad",
      titulo: created.titulo,
      asignacionId: created.asignacionId,
      itemId: created.id,
      fechaLimite: created.fechaLimite ?? null,
    }).catch((e) => console.warn("[Encargo] Error enviando notificación:", e));
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear encargo");
  }
}

export async function updateEncargo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<UpdateEncargoInput>(ctx);
    respond(ctx, 200, await encargoService.updateEncargo(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar encargo");
  }
}

export async function deleteEncargo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await encargoService.deleteEncargo(id);
    respond(ctx, 200, { message: `Encargo id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar encargo");
  }
}
