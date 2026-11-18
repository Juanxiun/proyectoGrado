import { getRedis } from "../connects/Redis/redis.ts";
import { query } from "../connects/Database/transaction.ts";

interface SesionEstudiante {
  inicioConexion: string;
  dispositivo?: { device?: string; os?: string; browser?: string };
  ubicacion?: { zona?: string; ciudad?: string; pais?: string };
}

interface ResumenIntentos {
  total: bigint;
  promedio: number | null;
}

// alerta -> promedio alto durante una sesion nueva
export async function evaluarRendimientoSesion(usuarioId: string, sessionId: string): Promise<void> {
  try {
    const redis = getRedis();
    const rawSesion = await redis.get(`session:${sessionId}`);
    if (!rawSesion) return;
    const sesion = JSON.parse(rawSesion) as SesionEstudiante;
    const inicio = new Date(sesion.inicioConexion);
    if (Number.isNaN(inicio.getTime())) return;

    const [sesionRes, historialRes] = await Promise.all([
      query<ResumenIntentos>(
        `SELECT COUNT(*) AS total, AVG(porcentaje_acierto)::float8 AS promedio
         FROM actividades_gamificadas
         WHERE usuario_id = $1 AND completada = true AND fecha_inicio >= $2`,
        [usuarioId, inicio.toISOString()],
      ),
      query<ResumenIntentos>(
        `SELECT COUNT(*) AS total, AVG(porcentaje_acierto)::float8 AS promedio FROM (
           SELECT porcentaje_acierto FROM actividades_gamificadas
           WHERE usuario_id = $1 AND completada = true AND fecha_inicio < $2
           ORDER BY fecha_inicio DESC LIMIT 10
         ) AS intentos_previos`,
        [usuarioId, inicio.toISOString()],
      ),
    ]);

    const actual = sesionRes.rows[0];
    const habitual = historialRes.rows[0];
    const actividadesSesion = Number(actual?.total ?? 0);
    const actividadesPrevias = Number(habitual?.total ?? 0);
    const promedioSesion = Number(actual?.promedio ?? 0);
    const promedioHabitual = Number(habitual?.promedio ?? 0);
    if (actividadesSesion < 3 || actividadesPrevias < 5 || promedioSesion - promedioHabitual < 0.2) return;

    const lockKey = `gamificacion:alerta-rendimiento-sesion:${sessionId}`;
    const nuevo = await redis.set(lockKey, "1", "EX", 60 * 60 * 24 * 7, "NX");
    if (nuevo !== "OK") return;

    const incidente = {
      tipo: "rendimiento_superior_en_sesion_nueva",
      usuarioId,
      sessionId,
      timestamp: new Date().toISOString(),
      alerta: "El promedio de actividades completadas en esta sesión supera en al menos 20 puntos porcentuales el promedio de los 10 intentos anteriores. Verificar con el estudiante; esto no identifica quién respondió.",
      promedioSesion: Number((promedioSesion * 100).toFixed(1)),
      promedioHabitual: Number((promedioHabitual * 100).toFixed(1)),
      actividadesSesion,
      dispositivo: sesion.dispositivo,
      ubicacion: sesion.ubicacion,
    };
    const alertasKey = `student_cheat_alerts:${usuarioId}`;
    await redis.lpush(alertasKey, JSON.stringify(incidente));
    await redis.ltrim(alertasKey, 0, 19);
  } catch (error) {
    console.warn("[gamificacion] No se pudo evaluar el rendimiento de la sesión:", error);
  }
}
