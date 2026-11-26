import { getRedis } from "../connects/Redis/redis.ts";
import { redisConfig } from "../config/redis.conf.ts";

const SERVICIO = "ServiceGamification";

// eventos -> canales websocket derivados del payload
function canalesWebSocket(payload: Record<string, unknown>): string[] {
  const canales = new Set<string>(["gamificacion:global"]);
  if (payload.usuarioId != null) canales.add(`gamificacion:personal:${payload.usuarioId}`);
  if (payload.cursoPeriodoId != null && (payload.paralelo === "A" || payload.paralelo === "B")) {
    canales.add(`gamificacion:paralelo:${payload.cursoPeriodoId}:${payload.paralelo}`);
  }
  return [...canales];
}

// eventos -> publicar avisos redis + fan-out websocket
export async function publicarEvento<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): Promise<boolean> {
  try {
    const redis = getRedis();
    const mensaje = JSON.stringify({
      eventType,
      origen,
      payload,
      emittedAt: new Date().toISOString(),
    });
    const mensajeWs = JSON.stringify({
      evento: eventType,
      payload,
      timestamp: new Date().toISOString(),
    });
    await Promise.allSettled([
      redis.publish(redisConfig.eventosCanal, mensaje),
      ...canalesWebSocket(payload).map((canal) => redis.publish(canal, mensajeWs)),
    ]);
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

