import { notificationConfig } from "../config/notification.config.ts";
import type { NotificationItem } from "../models/notification.ts";

// archivo -> push gateway signalr
interface PushBody {
  // campo -> usuario destino
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

// funcion -> entregar push usuario
export function publishNotification(destinatarioId: string, notif: NotificationItem): void {
  if (!notificationConfig.pushHabilitado) return;

  enviar({ destinatarioId, notificacion: notif, resource: "notificaciones" }).catch((err) => {
    console.warn(`[GatewayPush] No se pudo notificar en tiempo real a ${destinatarioId}:`, err);
  });
}

// funcion -> difundir push todos
export function broadcastNotification(notif: NotificationItem): void {
  if (!notificationConfig.pushHabilitado) return;

  enviar({ notificacion: notif, resource: "notificaciones" }).catch((err) => {
    console.warn("[GatewayPush] No se pudo difundir la notificación:", err);
  });
}
