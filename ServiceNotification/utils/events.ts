import { getRedis } from "../connects/Redis/redis.ts";

// archivo -> publicador eventos redis
const SERVICIO = "ServiceNotification";

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

// funcion -> publicar sin esperar
export function publicarEventoAsync<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): void {
  publicarEvento(eventType, payload, origen).catch(() => {
    // error -> ya registrado antes
  });
}

export { CANAL as EVENTOS_CANAL, SERVICIO as SERVICIO_ORIGEN };
