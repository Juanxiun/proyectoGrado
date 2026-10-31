import { getRedis } from "../connects/Redis/redis.ts";
import { redisConfig } from "../config/redis.conf.ts";
import { controlAcademicoConfig } from "../config/control-academico.config.ts";

const SERVICIO = "ServiceControlAcademico";

// eventos -> publicar avisos redis
export async function publicarEvento<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
  origen: string = SERVICIO,
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;

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

// eventos -> publicar en canal de control academico
export async function publicarEventoControl<T extends Record<string, unknown>>(
  eventType: string,
  payload: T,
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;

    await redis.publish(
      "control:eventos",
      JSON.stringify({
        eventType,
        origen: "ServiceControlAcademico",
        payload,
        emittedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch (err) {
    console.warn(`[Eventos] No se pudo publicar en canal control "${eventType}":`, err);
    return false;
  }
}

// helper -> publicar usando config
export function publicarEventoConfig<T extends Record<string, unknown>>(
  eventoKey: keyof typeof controlAcademicoConfig.wsEventos,
  payload: T,
): void {
  const eventType = controlAcademicoConfig.wsEventos[eventoKey];
  if (eventType) {
    publicarEventoControl(eventType, payload).catch(() => {});
  }
}