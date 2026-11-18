import { query } from "../connects/Database/transaction.ts";
import { RankingParalelo } from "../models/gamification.ts";
import { calcularProgresion, diaAnterior, fechaLocal } from "./gamification.calculo.ts";

// repo -> ranking estudiantes paralelo
export async function calcularRankingParalelo(cursoPeriodoId: string): Promise<RankingParalelo[]> {
  const res = await query<{
    usuario_id: string;
    estudiante_id: string;
    tag: string;
    nombre: string;
    apellido_paterno: string;
    avatar_url: string | null;
    paralelo: "A" | "B";
    racha_actual: number;
    mejor_racha: number;
    fecha_racha: string | null;
    promedio_rendimiento: number;
    calidad_promedio: number;
    tiempo_promedio_ms: number;
    puntos_individuales: number;
    actividades_completadas: number;
    insignias_count: number;
    trofeos_count: number;
  }>(`
    SELECT
      eg.usuario_id,
      eg.estudiante_id,
      eg.tag,
      eg.nombre,
      eg.apellido_paterno,
      eg.avatar_url,
      eg.paralelo,
      COALESCE(rd.racha_actual, 0) AS racha_actual,
      COALESCE(rd.mejor_racha, 0) AS mejor_racha,
      rd.fecha_racha,
      COALESCE(ap.promedio_rendimiento, 0) AS promedio_rendimiento,
      COALESCE(ap.calidad_promedio, 0) AS calidad_promedio,
      COALESCE(ap.tiempo_promedio_ms, 0) AS tiempo_promedio_ms,
      COALESCE(pi.total_puntos, 0) AS puntos_individuales,
      COALESCE(ap.actividades_completadas, 0) AS actividades_completadas,
      COALESCE(ie.count, 0) AS insignias_count,
      COALESCE(te.count, 0) AS trofeos_count
    FROM estudiantes_gamificacion eg
    LEFT JOIN (
      SELECT usuario_id, racha_actual, mejor_racha, fecha::text AS fecha_racha
      FROM rachas_diarias rd1
      WHERE fecha = (SELECT MAX(fecha) FROM rachas_diarias WHERE usuario_id = rd1.usuario_id)
    ) rd ON rd.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, paralelo,
             COUNT(*) FILTER (WHERE completada = true) AS actividades_completadas,
             AVG(porcentaje_acierto) AS promedio_rendimiento,
             AVG(CASE WHEN tiempo_total_ms > 0 THEN 1.0 ELSE 0.5 END) AS calidad_promedio,
             AVG(tiempo_total_ms) AS tiempo_promedio_ms
      FROM actividades_gamificadas
      WHERE completada = true AND curso_periodo_id = $1
      GROUP BY usuario_id, paralelo
    ) ap ON ap.usuario_id = eg.usuario_id AND ap.paralelo = eg.paralelo
    LEFT JOIN (
      SELECT usuario_id, paralelo,
             SUM(GREATEST(puntos, 0)) AS total_puntos
      FROM puntos_individuales
      WHERE curso_periodo_id = $1
      GROUP BY usuario_id, paralelo
    ) pi ON pi.usuario_id = eg.usuario_id AND pi.paralelo = eg.paralelo
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM insignias_estudiante GROUP BY usuario_id
    ) ie ON ie.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM trofeos_estudiante GROUP BY usuario_id
    ) te ON te.usuario_id = eg.usuario_id
    WHERE eg.curso_periodo_id = $1 AND eg.estado = 'activo'
    ORDER BY
      pi.total_puntos DESC,
      ap.promedio_rendimiento DESC,
      ap.calidad_promedio DESC,
      ap.tiempo_promedio_ms ASC
  `, [cursoPeriodoId]);

  const paralelos = ["A", "B"] as const;
  return paralelos.map((paralelo) => {
    const estudiantes = res.rows
      .filter((r) => r.paralelo === paralelo)
      .map((r, i) => ({
        usuarioId: String(r.usuario_id),
        estudianteId: String(r.estudiante_id),
        tag: r.tag,
        nombre: r.nombre,
        apellidoPaterno: r.apellido_paterno,
        avatarUrl: r.avatar_url,
        rachaActual: r.fecha_racha === fechaLocal() || r.fecha_racha === diaAnterior(fechaLocal())
          ? Number(r.racha_actual ?? 0)
          : 0,
        mejorRacha: Number(r.mejor_racha ?? 0),
        promedioRendimiento: Number(Number(r.promedio_rendimiento ?? 0).toFixed(2)),
        calidadPromedio: Number(Number(r.calidad_promedio ?? 0).toFixed(2)),
        tiempoPromedioMs: Number(r.tiempo_promedio_ms ?? 0),
        puntosIndividuales: Number(r.puntos_individuales ?? 0),
        actividadesCompletadas: Number(r.actividades_completadas ?? 0),
        ...calcularProgresion(Number(r.puntos_individuales ?? 0)),
        insigniasCount: Number(r.insignias_count ?? 0),
        trofeosCount: Number(r.trofeos_count ?? 0),
        posicion: i + 1,
      }));
    return { paralelo, cursoPeriodoId, estudiantes, actualizadaEn: new Date().toISOString() };
  });
}

// repo -> resumen gamificacion por materia
export async function obtenerResumenEstudianteMateria(
  estudianteId: string,
  usuarioId: string,
  cursoPeriodoId: string,
  materiaId: string,
): Promise<{
  actividadesCompletadas: number;
  intentos: number;
  promedioAcierto: number | null;
  puntosGanados: number;
  puntosCurso: number;
  rachaActual: number;
  mejorRacha: number;
  rachaCompletadaHoy: boolean;
  rachaSalvadaConPuntos: boolean;
}> {
  const [actividad, racha, puntos] = await Promise.all([
    query<{
      completadas: string;
      intentos: string;
      promedio_acierto: number | null;
      puntos: string;
    }>(
      `SELECT COUNT(*) FILTER (WHERE completada = true) AS completadas,
              COUNT(*) AS intentos,
              AVG(porcentaje_acierto)::float8 AS promedio_acierto,
              COALESCE(SUM(CASE WHEN completada THEN puntos_ganados ELSE 0 END), 0) AS puntos
       FROM actividades_gamificadas
       WHERE estudiante_id = $1 AND curso_periodo_id = $2 AND materia_id = $3`,
      [estudianteId, cursoPeriodoId, materiaId],
    ),
    query<{
      fecha: string;
      completada: boolean;
      racha_actual: number;
      mejor_racha: number;
      salvada_con_puntos: boolean;
    }>(
      `SELECT fecha::text AS fecha, completada, racha_actual, mejor_racha, salvada_con_puntos
       FROM rachas_diarias WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 1`,
      [usuarioId],
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total
       FROM puntos_individuales WHERE usuario_id = $1 AND curso_periodo_id = $2`,
      [usuarioId, cursoPeriodoId],
    ),
  ]);

  const actividadRow = actividad.rows[0];
  const rachaRow = racha.rows[0];
  const hoy = fechaLocal();
  const fechaRachaVigente = rachaRow?.fecha === hoy || rachaRow?.fecha === diaAnterior(hoy);

  return {
    actividadesCompletadas: Number(actividadRow?.completadas ?? 0),
    intentos: Number(actividadRow?.intentos ?? 0),
    promedioAcierto: actividadRow?.promedio_acierto === null || actividadRow?.promedio_acierto === undefined
      ? null
      : Number(actividadRow.promedio_acierto) * 100,
    puntosGanados: Number(actividadRow?.puntos ?? 0),
    puntosCurso: Number(puntos.rows[0]?.total ?? 0),
    rachaActual: fechaRachaVigente ? Number(rachaRow?.racha_actual ?? 0) : 0,
    mejorRacha: Number(rachaRow?.mejor_racha ?? 0),
    rachaCompletadaHoy: rachaRow?.fecha === hoy && Boolean(rachaRow.completada),
    rachaSalvadaConPuntos: rachaRow?.fecha === hoy && Boolean(rachaRow.salvada_con_puntos),
  };
}

