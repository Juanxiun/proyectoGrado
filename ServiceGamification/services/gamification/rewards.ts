import { query } from "../../connects/Database/transaction.ts";
import type {
  ActividadGamificada,
  InsigniaEstudiante,
  RachasDiarias,
  TrofeoEstudiante,
} from "../../models/gamification.ts";
import { calcularRankingParalelo } from "../gamification.ranking.ts";
import {
  getInsigniasActivas,
  getInsigniasEstudiante,
  getTrofeosActivos,
  getTrofeosEstudiante,
  otorgarInsignia,
  otorgarTrofeo,
} from "./repository.ts";

// gamificacion -> evaluacion de insignias dinamicas por desempeno
export async function otorgarInsigniaDinamica(
  estudianteId: string,
  puntuacion: number,
  tiempoMs: number,
  mediaTiempoOtros: number,
  intentoAnterior: { puntuacion: number; fecha: string } | null,
): Promise<InsigniaEstudiante[]> {
  const [insigniasActivas, insigniasEstudiante] = await Promise.all([
    getInsigniasActivas(),
    getInsigniasEstudiante(estudianteId),
  ]);
  const tieneInsignia = new Set(insigniasEstudiante.map((i) => i.insigniaId));

  let codigoInsignia =
    puntuacion === 10 ? "maestro_perfecto"
    : puntuacion >= 8 ? "experto_rapido"
    : puntuacion >= 6 ? "vamos_buen_camino"
    : puntuacion >= 4 ? "esfuerzo_constante"
    : "empezando";
  let metadata: Record<string, unknown> = { puntuacion };

  if (intentoAnterior && puntuacion > intentoAnterior.puntuacion + 2) {
    codigoInsignia = "mejora_notable";
    metadata = { ...metadata, mejora: puntuacion - intentoAnterior.puntuacion };
  }
  if (puntuacion === 10 && tiempoMs > 0 && mediaTiempoOtros > 0 && tiempoMs < mediaTiempoOtros / 2) {
    codigoInsignia = "speedrunner";
  }

  const insignia = insigniasActivas.find((i) => i.codigo === codigoInsignia);
  if (!insignia || tieneInsignia.has(insignia.id)) return [];
  const otorgada = await otorgarInsignia(estudianteId, insignia.id, metadata);
  return otorgada ? [otorgada] : [];
}

// gamificacion -> evaluacion de insignias tradicionales por hitos
export async function evaluarInsignias(
  usuarioId: string,
  _estudianteId: string,
  contexto: {
    actividad: ActividadGamificada;
    racha: RachasDiarias;
    puntosGanados: number;
    aciertos: number;
    total: number;
    tiempoTotalMs: number;
  },
): Promise<InsigniaEstudiante[]> {
  const [insigniasActivas, insigniasEstudiante] = await Promise.all([
    getInsigniasActivas(),
    getInsigniasEstudiante(usuarioId),
  ]);
  const tieneInsignia = new Set(insigniasEstudiante.map((i) => i.insigniaId));
  const nuevas: InsigniaEstudiante[] = [];

  for (const insignia of insigniasActivas) {
    if (tieneInsignia.has(insignia.id)) continue;
    let cumple = false;

    switch (insignia.codigo) {
      case "speedrun":
        cumple = contexto.total >= 5 &&
          contexto.aciertos / contexto.total >= 0.8 &&
          contexto.tiempoTotalMs > 0 &&
          contexto.tiempoTotalMs <= 30000;
        break;
      case "nuevo_aprendizaje": {
        const actMateria = await query<{ count: string }>(
          `SELECT COUNT(*) FROM actividades_gamificadas WHERE usuario_id = $1 AND materia_id = $2`,
          [usuarioId, contexto.actividad.materiaId],
        );
        cumple = Number(actMateria.rows[0]?.count ?? 0) === 1;
        break;
      }
      case "repaso_masivo":
        cumple = contexto.total >= 20 && contexto.aciertos >= contexto.total * 0.8;
        break;
      case "reincorporacion": {
        const ultima = await query<{ fecha_inicio: string }>(
          `SELECT fecha_inicio FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT 2`,
          [usuarioId],
        );
        if (ultima.rows.length === 2) {
          const diff = new Date(ultima.rows[0].fecha_inicio).getTime() - new Date(ultima.rows[1].fecha_inicio).getTime();
          cumple = diff > 7 * 24 * 60 * 60 * 1000;
        }
        break;
      }
    }

    if (cumple) {
      const otorgada = await otorgarInsignia(usuarioId, insignia.id, { contexto: insignia.codigo });
      if (otorgada) nuevas.push(otorgada);
    }
  }
  return nuevas;
}

// gamificacion -> evaluacion de trofeos periodicos
export async function evaluarTrofeos(
  usuarioId: string,
  cursoPeriodoId: string,
  paralelo: "A" | "B",
): Promise<TrofeoEstudiante[]> {
  const [trofeosActivos, trofeosEstudiante, rankings] = await Promise.all([
    getTrofeosActivos(),
    getTrofeosEstudiante(usuarioId),
    calcularRankingParalelo(cursoPeriodoId),
  ]);
  const tieneTrofeo = new Set(trofeosEstudiante.map((t) => t.trofeoId));
  const miRanking = rankings.find((r) => r.paralelo === paralelo);
  const miPosicion = miRanking?.estudiantes.find((e) => e.usuarioId === usuarioId)?.posicion ?? 999;
  const nuevos: TrofeoEstudiante[] = [];

  for (const trofeo of trofeosActivos) {
    if (tieneTrofeo.has(trofeo.id)) continue;
    let cumple = false;

    switch (trofeo.codigo) {
      case "mejor_semana":
        cumple = miPosicion === 1;
        break;
      case "alto_rendimiento": {
        const rend = await query<{ avg: string }>(
          `SELECT AVG(porcentaje_acierto) AS avg FROM actividades_gamificadas WHERE usuario_id = $1 AND completada = true AND fecha_inicio >= NOW() - INTERVAL '3 months'`,
          [usuarioId],
        );
        cumple = Number(rend.rows[0]?.avg ?? 0) >= 0.9;
        break;
      }
      case "dominio_total": {
        const [insig, totalIns] = await Promise.all([
          query<{ count: string }>(`SELECT COUNT(*) FROM insignias_estudiante WHERE usuario_id = $1`, [usuarioId]),
          query<{ count: string }>(`SELECT COUNT(*) FROM insignias WHERE activa = true`),
        ]);
        cumple = Number(insig.rows[0]?.count ?? 0) >= Number(totalIns.rows[0]?.count ?? 0);
        break;
      }
    }

    if (cumple) {
      const otorgado = await otorgarTrofeo(usuarioId, trofeo.id, trofeo.puntos);
      if (otorgado) nuevos.push(otorgado);
    }
  }
  return nuevos;
}
