import { query } from "../connects/Database/transaction.ts";
import { asDateTimeString } from "../utils/serialize.ts";
import { getRedis } from "../connects/Redis/redis.ts";

// service -> evidencia de aprendizaje
export async function getEvidenciaAprendizaje(usuarioId: string): Promise<Record<string, unknown>> {
  const [actividades, eventos, temas, conteos] = await Promise.all([
    query<{ titulo: string; tipo: string; porcentaje_acierto: number; tiempo_total_ms: number; total: number; puntos_ganados: number; fecha_inicio: string; material_id: string | null; tema_ruta_id: string | null; numero_tema: string | null; titulo_tema: string | null; preguntas: unknown[]; respuestas: unknown[] }>(
      `SELECT titulo, tipo, porcentaje_acierto::float8 AS porcentaje_acierto, tiempo_total_ms, total, puntos_ganados, fecha_inicio,
              preguntas->0->'contexto'->>'materialId' AS material_id,
              preguntas->0->'contexto'->>'temaRutaId' AS tema_ruta_id,
              preguntas->0->'contexto'->>'numeroTema' AS numero_tema,
              preguntas->0->'contexto'->>'tituloTema' AS titulo_tema,
              preguntas, respuestas
       FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT 500`,
      [usuarioId],
    ),
    query<{ evento: string; content_id: string; titulo: string; formato: string | null; fecha: string; material_id: string | null; tema_ruta_id: string | null; numero_tema: number | null; titulo_tema: string | null; veces_repetido: number | null; tiempo_lectura_ms: number | null; partes_explicadas: string[] | null; pregunta_indagacion: string | null }>(
      `SELECT metadata->>'evento' AS evento, metadata->>'contentId' AS content_id,
              COALESCE(metadata->>'titulo', '') AS titulo, metadata->>'formato' AS formato,
              metadata->>'materialId' AS material_id, metadata->>'temaRutaId' AS tema_ruta_id,
              NULLIF(metadata->>'numeroTema','')::int AS numero_tema,
              metadata->>'tituloTema' AS titulo_tema,
              NULLIF(metadata->>'vecesRepetido','')::int AS veces_repetido,
              NULLIF(metadata->>'tiempoLecturaMs','')::bigint::float8 AS tiempo_lectura_ms,
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(metadata->'partesExplicadas','[]'::jsonb))) AS partes_explicadas,
              metadata->>'preguntaIndagacion' AS pregunta_indagacion,
              creada_en AS fecha
       FROM puntos_individuales WHERE usuario_id = $1
         AND metadata->>'evento' IN ('resumen_completado', 'investigacion', 'tema_completado')
       ORDER BY creada_en DESC LIMIT 300`,
      [usuarioId],
    ),
    query<{ tema: string }>(
      `SELECT DISTINCT metadata->>'titulo' AS tema FROM puntos_individuales
       WHERE usuario_id = $1 AND metadata->>'evento' = 'investigacion'
         AND NULLIF(BTRIM(metadata->>'titulo'), '') IS NOT NULL ORDER BY tema`,
      [usuarioId],
    ),
    query<{ total_investigaciones: string; resumenes_completados: string }>(
      `SELECT COUNT(*) FILTER (WHERE metadata->>'evento' = 'investigacion') AS total_investigaciones,
              COUNT(*) FILTER (WHERE metadata->>'evento' = 'resumen_completado') AS resumenes_completados
       FROM puntos_individuales WHERE usuario_id = $1
         AND metadata->>'evento' IN ('resumen_completado', 'investigacion')`,
      [usuarioId],
    ),
  ]);
  const actualesPorTema = new Map<string, number>();
  let actividadesSinTema = 0;
  const actividadesRecientes = actividades.rows.filter((item) => {
    if (!item.tema_ruta_id) return actividadesSinTema++ < 5;
    const cuenta = actualesPorTema.get(item.tema_ruta_id) ?? 0;
    actualesPorTema.set(item.tema_ruta_id, cuenta + 1);
    return cuenta < 5;
  });
  const redis = getRedis();
  const progresosTemas: Record<string, unknown>[] = [];
  let cursor = "0";
  do {
    const [siguiente, keys] = await redis.scan(cursor, "MATCH", `gamificacion:tema-progreso:${usuarioId}:*`, "COUNT", 100);
    cursor = String(siguiente);
    if (keys.length) {
      const valores = await redis.mget(...keys);
      for (const valor of valores) {
        if (!valor) continue;
        try { progresosTemas.push(JSON.parse(valor)); } catch { /* Redis -> ignorar progreso corrupto */ }
      }
    }
  } while (cursor !== "0");
  return {
    actividades: actividadesRecientes.map((item) => ({
      titulo: item.titulo,
      tipo: item.tipo,
      porcentaje: Number(item.porcentaje_acierto),
      duracionMs: item.tiempo_total_ms,
      preguntasTotal: item.total,
      tiempoPorPreguntaMs: item.total > 0 ? Math.round(item.tiempo_total_ms / item.total) : 0,
      fecha: asDateTimeString(item.fecha_inicio),
      materialId: item.material_id,
      temaRutaId: item.tema_ruta_id,
      numeroTema: item.numero_tema ? Number(item.numero_tema) : undefined,
      tituloTema: item.titulo_tema,
      preguntas: item.preguntas,
      respuestas: item.respuestas,
    })),
    eventosEstudio: eventos.rows.map((item) => ({
      tipo: item.evento,
      tema: item.titulo,
      contentId: item.content_id,
      materialId: item.material_id,
      temaRutaId: item.tema_ruta_id,
      numeroTema: item.numero_tema ?? undefined,
      tituloTema: item.titulo_tema,
      vecesRepetido: item.veces_repetido ?? undefined,
      tiempoLecturaMs: item.tiempo_lectura_ms === null ? undefined : Number(item.tiempo_lectura_ms),
      partesExplicadas: item.partes_explicadas ?? [],
      preguntaIndagacion: item.pregunta_indagacion,
      formato: item.formato,
      fecha: asDateTimeString(item.fecha),
    })),
    progresosTemas,
    totalActividades: actividadesRecientes.length,
    totalInvestigaciones: Number(conteos.rows[0]?.total_investigaciones ?? 0),
    temasIndagados: temas.rows.map((item) => item.tema),
    temasIndagadosCount: temas.rows.length,
    resumenesCompletados: Number(conteos.rows[0]?.resumenes_completados ?? 0),
  };
}

