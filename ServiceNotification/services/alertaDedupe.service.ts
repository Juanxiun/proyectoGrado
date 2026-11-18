import { getRedis } from "../connects/Redis/redis.ts";

// archivo -> deduplicar avisos riesgo
const TTL_SEGUNDOS = 60 * 60 * 12; // valor -> doce horas

function clave(estudianteId: string, trimestre: number, nivel: string): string {
  return `alerta:riesgo:${estudianteId}:t${trimestre}:${nivel}`;
}

// funcion -> verificar aviso previo
export async function yaAvisado(
  estudianteId: string,
  trimestre: number,
  nivel: string,
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    return Boolean(await redis.exists(clave(estudianteId, trimestre, nivel)));
  } catch {
    // error -> avisar igualmente
    return false;
  }
}

export async function marcarAvisado(
  estudianteId: string,
  trimestre: number,
  nivel: string,
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(clave(estudianteId, trimestre, nivel), "1", "EX", TTL_SEGUNDOS);
  } catch {
    // error -> seguir sin dedupe
  }
}

// funcion -> limpiar avisos
export async function limpiarAvisos(estudianteId: string, trimestre: number): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    const patrones = [
      `alerta:riesgo:${estudianteId}:t${trimestre}:*`,
    ];
    for (const patron of patrones) {
      const claves: string[] = await redis.keys(patron);
      if (claves.length > 0) await redis.del(...claves);
    }
  } catch {
    // error -> limpieza oportunista
  }
}
