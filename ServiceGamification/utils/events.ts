import { getRedis } from "../connects/Redis/redis.ts";
import { redisConfig } from "../config/redis.conf.ts";

const SERVICIO = "ServiceGamification";

// eventos -> publicar avisos redis
export async function publicarEvento<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.publish(
      redisConfig.eventosCanal,
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

// eventos -> publicar sin bloquear
export function publicarEventoAsync<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): void {
  publicarEvento(eventType, payload, origen).catch(() => {
    // eventos -> error ya registrado
  });
}

// eventos -> publicar en canal especifico
export async function publicarEnCanal<T extends Record<string, unknown>>(
  canal: string,
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.publish(canal, JSON.stringify({
      eventType,
      origen,
      payload,
      emittedAt: new Date().toISOString(),
    }));
    return true;
  } catch (err) {
    console.warn(`[Eventos] No se pudo publicar en "${canal}" "${eventType}":`, err);
    return false;
  }
}