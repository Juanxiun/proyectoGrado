import { Context } from "@oak/oak";
import {
  NotificationService,
} from "../services/notification.service.ts";
import { readJsonBody, respond, routeParam } from "../utils/http.ts";
import type { AuthClaims } from "../security/auth.ts";

export async function listNotificaciones(ctx: Context): Promise<void> {
  const claims = (ctx.state.auth as AuthClaims) ?? null;
  const usuarioId = claims?.sub ?? ctx.request.url.searchParams.get("usuarioId");
  const unreadOnly = ctx.request.url.searchParams.get("unreadOnly") === "true";

  if (!usuarioId) {
    respond(ctx, 401, { error: "Usuario no identificado para notificaciones" });
    return;
  }

  const notifs = unreadOnly
    ? await NotificationService.getUnread(usuarioId)
    : await NotificationService.getUserNotifications(usuarioId);

  respond(ctx, 200, notifs);
}

export async function readNotificacion(ctx: Context): Promise<void> {
  const claims = (ctx.state.auth as AuthClaims) ?? null;
  const usuarioId = claims?.sub ?? ctx.request.url.searchParams.get("usuarioId");
  const notifId = routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id");

  if (!usuarioId || !notifId) {
    respond(ctx, 400, { error: "notifId y usuarioId son requeridos" });
    return;
  }

  const success = await NotificationService.markAsRead(usuarioId, notifId);
  respond(ctx, 200, { success });
}

export async function sendNotificationToUser(ctx: Context): Promise<void> {
  const body = await readJsonBody<{ userId: string; payload: any }>(ctx);
  if (!body.userId || !body.payload) {
    respond(ctx, 400, { error: "userId y payload son requeridos" });
    return;
  }

  const notif = await NotificationService.sendToUser(body.userId, body.payload);
  respond(ctx, 201, notif);
}

export async function sendNotificationToCourse(ctx: Context): Promise<void> {
  const body = await readJsonBody<{ courseId: string; parallelId?: string; payload: any }>(ctx);
  if (!body.courseId || !body.payload) {
    respond(ctx, 400, { error: "courseId y payload son requeridos" });
    return;
  }

  const notif = await NotificationService.sendToCourse(body.courseId, body.parallelId, body.payload);
  respond(ctx, 201, notif);
}
