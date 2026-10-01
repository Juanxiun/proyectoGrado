import { notificationConfig } from "../config/notification.config.ts";
import type { NotificationItem } from "../models/notification.ts";

/**
 * Push en tiempo real hacia el gateway.
 *
 * El gateway (RestApi) es el único proceso que mantiene sockets públicos, así
 * que este servicio nunca se conecta al cliente: le entrega la notificación y
 * él la reenvía por el hub SignalR a la banda del usuario.
 */
interface PushBody {
  /** Usuario destino. Si se omite, el gateway hace broadcast a todos. */
  destinatarioId?: string;
  notificacion?: NotificationItem;
  resource: string;
}

function pushEndpoint(): string {
  return `${notificationConfig.gatewayPublicUrl.replace(/\/$/, "")}/api/internal/notificaciones/push`;
}

async function enviar(body: PushBody): Promise<void> {
  if (!notificationConfig.pushHabilitado) return;

  const response = await fetch(pushEndpoint(), {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Token": notificationConfig.internalPushToken,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`El gateway respondió ${response.status}`);
  }
}

/** Entrega la notificación al usuario indicado. Nunca lanza. */
export function publishNotification(destinatarioId: string, notif: NotificationItem): void {
  if (!notificationConfig.pushHabilitado) return;

  enviar({ destinatarioId, notificacion: notif, resource: "notificaciones" }).catch((err) => {
    console.warn(`[GatewayPush] No se pudo notificar en tiempo real a ${destinatarioId}:`, err);
  });
}

/** Difusión a todos los clientes conectados (canal institucional). */
export function broadcastNotification(notif: NotificationItem): void {
  if (!notificationConfig.pushHabilitado) return;

  enviar({ notificacion: notif, resource: "notificaciones" }).catch((err) => {
    console.warn("[GatewayPush] No se pudo difundir la notificación:", err);
  });
}
