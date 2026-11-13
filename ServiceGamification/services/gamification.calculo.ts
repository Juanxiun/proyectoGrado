// calculo -> reglas puras de fechas y puntuacion
import { gamificationConfig } from "../config/gamification.config.ts";
import { ActividadGamificada } from "../models/gamification.ts";

// fecha -> dia local de gamificacion
export function fechaLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatearFecha(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// fecha -> dia local anterior
export function diaAnterior(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  return formatearFecha(new Date(Date.UTC(year, month - 1, day - 1)));
}

// fecha -> lunes local de la semana
export function inicioSemana(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return formatearFecha(date);
}

// curso -> nivel, rango y puntos al siguiente nivel
export function calcularProgresion(puntosCurso: number): { nivel: number; rango: "D" | "C" | "B" | "A" | "S"; puntosSiguienteNivel: number } {
  const nivel = Math.min(gamificationConfig.progresion.nivelMaximo, Math.floor(Math.max(0, puntosCurso) / gamificationConfig.progresion.puntosPorNivel));
  const rango = nivel < 10 ? "D" : nivel < 20 ? "C" : nivel < 45 ? "B" : nivel < 60 ? "A" : "S";
  return { nivel, rango, puntosSiguienteNivel: nivel >= gamificationConfig.progresion.nivelMaximo ? 0 : gamificationConfig.progresion.puntosPorNivel - (Math.max(0, puntosCurso) % gamificationConfig.progresion.puntosPorNivel) };
}

// actividad -> aciertos, tiempo y puntos por calidad
export function calcularPuntos(
  respuestas: ActividadGamificada["respuestas"],
  preguntas: ActividadGamificada["preguntas"],
  tiempoTotalMs: number,
) {
  let aciertos = 0;
  let puntosCalidad = 0;
  let puntosTiempo = 0;

  const preguntaMap = new Map(preguntas.map((p) => [p.id, p]));

  for (const r of respuestas) {
    if (r.correcta) {
      aciertos++;
      const pregunta = preguntaMap.get(r.preguntaId);
      const base = pregunta?.puntosBase ?? 5;
      const tiempoPregunta = r.tiempoMs;
      const tiempoLimite = pregunta?.tiempoLimiteMs ?? 60000;
      const factorTiempo = Math.max(0.5, 1 - tiempoPregunta / tiempoLimite);
      puntosCalidad += Math.round(base * 0.6);
      puntosTiempo += Math.round(base * 0.4 * factorTiempo);
    }
  }

  const total = preguntas.length;
  const porcentajeAcierto = total > 0 ? aciertos / total : 0;
  const puntosGanados = aciertos * 5 + puntosCalidad + puntosTiempo;

  return { aciertos, total, porcentajeAcierto, puntosGanados, puntosCalidad, puntosTiempo };
}

// gamificacion -> puntuacion 2-10
export function calcularPuntuacion(
  aciertos: number,
  total: number,
  tiempoMs: number,
  mediaTiempoOtros: number,
): number {
  if (total === 0) return 2;
  const porcentaje = aciertos / total;
  let puntuacion = 2;

  if (porcentaje >= 0.9) puntuacion += 4;
  else if (porcentaje >= 0.7) puntuacion += 3;
  else if (porcentaje >= 0.5) puntuacion += 2;
  else if (porcentaje >= 0.3) puntuacion += 1;

  if (tiempoMs > 0 && mediaTiempoOtros > 0) {
    const ratio = tiempoMs / mediaTiempoOtros;
    if (ratio <= 0.5) puntuacion += 2;
    else if (ratio <= 0.75) puntuacion += 1;
  }

  if (aciertos === total) puntuacion += 2;

  return Math.min(10, Math.max(2, puntuacion));
}

// actividad -> cumple criterio speedrun
export function esSpeedrun(aciertos: number, total: number, tiempoMs: number): boolean {
  return total >= 5 && aciertos / total >= 0.8 && tiempoMs > 0 && tiempoMs <= 30000;
}
