import { getRedis } from "../connects/Redis/redis.ts";

/**
 * Publicador de eventos de dominio.
 *
 * Los servicios NO llaman directamente al servicio de notificaciones: publican
 * su cambio en un canal de Redis y ServiceNotification decide a quién le
 * corresponde un aviso (ver su `services/reglas.service.ts`). Así, agregar una
 * notificación nueva no obliga a tocar este servicio.
 *
 * Es una notificación al mejor esfuerzo: si Redis no responde, la operación de
 * negocio continúa y sólo se pierde el aviso.
 */
const SERVICIO = "ServiceUser";

const CANAL = Deno.env.get("EVENTOS_CANAL") ?? "notificaciones:eventos";

export async function publicarEvento<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;

    await redis.publish(
      CANAL,
      JSON.stringify({
        eventType,
        origen,
        payload,
        emittedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch (err) {
    console.warn(`[Eventos] No se pudo publicar "${eventType}":`, err);
    return false;
  }
}

/** Igual que `publicarEvento` pero sin esperar: nunca interrumpe la respuesta. */
export function publicarEventoAsync<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): void {
  publicarEvento(eventType, payload, origen).catch(() => {
    /* ya registrado en publicarEvento */
  });
}

export { CANAL as EVENTOS_CANAL, SERVICIO as SERVICIO_ORIGEN };
