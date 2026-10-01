/**
 * Umbrales del seguimiento académico. Centralizados aquí para que dirección
 * pueda ajustar el criterio de riesgo sin tocar la lógica de cálculo.
 */
export const seguimientoConfig = {
  /** Escala de notas: 0 a 100 (la que usa `calificaciones.nota`). */
  notaMaxima: 100,

  /** Por debajo de este promedio el estudiante entra en riesgo académico. */
  umbralNotaRiesgo: Number(Deno.env.get("SEG_NOTA_RIESGO") ?? 60),

  /** Por debajo de este porcentaje de asistencia hay riesgo por inasistencia. */
  umbralAsistenciaRiesgo: Number(Deno.env.get("SEG_ASISTENCIA_RIESGO") ?? 75),

  /** Ambos umbrales incumplidos a la vez = riesgo alto. */
  umbralNotaRiesgoAlto: Number(Deno.env.get("SEG_NOTA_RIESGO_ALTO") ?? 50),
  umbralAsistenciaRiesgoAlto: Number(Deno.env.get("SEG_ASISTENCIA_RIESGO_ALTO") ?? 60),

  /**
   * Banda de observación: asistencia por debajo de este valor pero todavía por
   * encima del umbral de riesgo. Debe ser MAYOR que `umbralAsistenciaRiesgo`;
   * si es menor, la banda queda vacía y nunca se muestra.
   */
  umbralAsistenciaObservacion: Number(Deno.env.get("SEG_ASISTENCIA_OBSERVACION") ?? 85),

  /** Ponderación de la asistencia dentro del índice de desempeño (0-1). */
  pesoAsistencia: Number(Deno.env.get("SEG_PESO_ASISTENCIA") ?? 0.3),
  pesoPromedio: Number(Deno.env.get("SEG_PESO_PROMEDIO") ?? 0.7),
} as const;
