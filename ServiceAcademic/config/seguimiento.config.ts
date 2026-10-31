// config -> umbrales seguimiento academico
export const seguimientoConfig = {
  // config -> escala notas cero cien
  notaMaxima: 100,

  // config -> umbral riesgo promedio
  umbralNotaRiesgo: Number(Deno.env.get("SEG_NOTA_RIESGO") ?? 60),

  // config -> umbral riesgo asistencia
  umbralAsistenciaRiesgo: Number(Deno.env.get("SEG_ASISTENCIA_RIESGO") ?? 75),

  // config -> ambos umbrales riesgo alto
  umbralNotaRiesgoAlto: Number(Deno.env.get("SEG_NOTA_RIESGO_ALTO") ?? 50),
  umbralAsistenciaRiesgoAlto: Number(Deno.env.get("SEG_ASISTENCIA_RIESGO_ALTO") ?? 60),

  // config -> banda observacion asistencia
  umbralAsistenciaObservacion: Number(Deno.env.get("SEG_ASISTENCIA_OBSERVACION") ?? 85),

  // config -> pesos indice desempeno
  pesoAsistencia: Number(Deno.env.get("SEG_PESO_ASISTENCIA") ?? 0.3),
  pesoPromedio: Number(Deno.env.get("SEG_PESO_PROMEDIO") ?? 0.7),
} as const;
