import { getRedis } from "../connects/Redis/redis.ts";

/**
 * Evita que un estudiante reciba el mismo aviso de riesgo cada vez que se
 * toca una nota o la asistencia.
 *
 * La clave incluye el trimestre, de modo que al empezar un trimestre nuevo el
 * aviso puede volver a salir aunque el riesgo siga igual.
 */
const TTL_SEGUNDOS = 60 * 60 * 12; // 12 horas

function clave(estudianteId: string, trimestre: number, nivel: string): string {
  return `alerta:riesgo:${estudianteId}:t${trimestre}:${nivel}`;
}

/** Devuelve true si ya se avisó y no hay que repetir el envío. */
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
    // Si Redis falla preferimos avisar de más antes que dejar de avisar.
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
    /* sin deduplicación, pero el envío funciona */
  }
}

/** Libera los avisos de un estudiante, p. ej. cuando sube su desempeño. */
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
    /* la limpieza es oportunista */
  }
}
