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

  const endpoint = pushEndpoint();
  let ultimoError: unknown;

  for (let intento = 1; intento <= 5; intento++) {
    try {
      const response = await fetch(endpoint, {
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
      return;
    } catch (err) {
      ultimoError = err;
      if (intento < 5) await new Promise((resolve) => setTimeout(resolve, intento * 1000));
    }
  }

  throw new Error(`No se pudo comunicar con ${endpoint} después de 5 intentos: ${String(ultimoError)}`);
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
