import { Context } from "@oak/oak";
import { NotificationService } from "../services/notification.service.ts";
import { HttpError } from "../utils/errors.ts";
import {
  handleControllerError,
  parsePagination,
  respond,
  routeParam,
} from "../utils/http.ts";
import type { AuthClaims } from "../security/auth.ts";

/**
 * Identidad del destinatario. Se toma siempre del JWT; el query `usuarioId`
 * sólo se acepta para las llamadas internas del gateway que ya validaron el
 * token, y en ese caso debe coincidir con el sujeto del token.
 */
function resolveUsuarioId(ctx: Context): string {
  const claims = (ctx.state.auth as AuthClaims) ?? null;
  const fromToken = claims?.sub ? String(claims.sub) : null;
  const fromQuery = ctx.request.url.searchParams.get("usuarioId");

  if (!fromToken && !fromQuery) {
    throw new HttpError(401, "Usuario no identificado para notificaciones");
  }
  if (fromToken && fromQuery && fromToken !== fromQuery) {
    throw new HttpError(403, "No puede consultar las notificaciones de otro usuario");
  }

  return (fromToken ?? fromQuery) as string;
}

export async function listNotificaciones(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    const { limit } = parsePagination(ctx.request.url.searchParams);
    const unreadOnly = ctx.request.url.searchParams.get("unreadOnly") === "true";

    respond(ctx, 200, await NotificationService.list(usuarioId, { unreadOnly, limit }));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar notificaciones");
  }
}

export async function countNotificaciones(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    respond(ctx, 200, await NotificationService.count(usuarioId));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al contar notificaciones");
  }
}

export async function getNotificacion(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    const id = routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id");
    if (!id) throw new HttpError(400, "El id de la notificación es requerido");

    const notif = await NotificationService.getById(usuarioId, id);
    if (!notif) throw new HttpError(404, "Notificación no encontrada");

    respond(ctx, 200, notif);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la notificación");
  }
}

export async function readNotificacion(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    const id = routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id");
    if (!id) throw new HttpError(400, "El id de la notificación es requerido");

    respond(ctx, 200, { success: await NotificationService.markAsRead(usuarioId, id) });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al marcar la notificación como leída");
  }
}

export async function readAllNotificaciones(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    const marcadas = await NotificationService.markAllAsRead(usuarioId);
    respond(ctx, 200, { success: true, marcadas });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al marcar todas las notificaciones");
  }
}

export async function deleteNotificacion(ctx: Context): Promise<void> {
  try {
    const usuarioId = resolveUsuarioId(ctx);
    const id = routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id");
    if (!id) throw new HttpError(400, "El id de la notificación es requerido");

    respond(ctx, 200, { success: await NotificationService.removeForUser(usuarioId, id) });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la notificación");
  }
}
