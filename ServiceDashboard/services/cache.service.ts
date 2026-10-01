import { getRedis } from "../connects/Redis/redis.ts";
import { dashboardConfig } from "../config/dashboard.config.ts";

/**
 * Caché de corta duración para las proyecciones.
 *
 * El dashboard se refresca seguido y las agregaciones son caras, así que se
 * tolera una ventana de desactualización. La clave incluye el alcance y el
 * período, de modo que dos roles o dos períodos nunca comparten datos.
 *
 * Si Redis no está disponible el dashboard NO falla: recalcula y sigue.
 */

function clave(seccion: string, alcance: string, periodoId: string, extra = ""): string {
  return `dashboard:${seccion}:${alcance}:${periodoId}${extra ? `:${extra}` : ""}`;
}

export interface CacheInfo {
  cacheado: boolean;
  duracionMs: number;
}

export async function conCache<T>(
  seccion: string,
  alcance: string,
  periodoId: string,
  calcular: () => Promise<T>,
  extra = "",
): Promise<{ datos: T; info: CacheInfo }> {
  const inicio = Date.now();
  const ttl = dashboardConfig.cacheTtl;

  if (ttl <= 0) {
    const datos = await calcular();
    return { datos, info: { cacheado: false, duracionMs: Date.now() - inicio } };
  }

  const key = clave(seccion, alcance, periodoId, extra);

  try {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.get(key);
      if (raw) {
        return {
          datos: JSON.parse(raw) as T,
          info: { cacheado: true, duracionMs: Date.now() - inicio },
        };
      }
    }
  } catch (err) {
    console.warn("[Cache] Fallo de lectura, se recalcula:", err);
  }

  const datos = await calcular();

  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(key, JSON.stringify(datos), "EX", ttl);
    }
  } catch (err) {
    console.warn("[Cache] Fallo de escritura:", err);
  }

  return { datos, info: { cacheado: false, duracionMs: Date.now() - inicio } };
}

export async function invalidarDashboard(): Promise<number> {
  try {
    const redis = getRedis();
    if (!redis) return 0;
    const claves: string[] = await redis.keys("dashboard:*");
    if (claves.length === 0) return 0;
    await redis.del(...claves);
    return claves.length;
  } catch (err) {
    console.warn("[Cache] Fallo al invalidar:", err);
    return 0;
  }
}
