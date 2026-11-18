// config -> configuracion dashboard lectura
export const dashboardConfig = {
  // config -> ttl cache proyecciones
  cacheTtl: Number(Deno.env.get("DASHBOARD_CACHE_TTL") ?? 60),

  // config -> periodo por defecto
  periodoPorDefecto: Deno.env.get("PERIODO_POR_DEFECTO") ?? "activo",

  // config -> dias proyeccion cobranza
  diasProyeccion: Number(Deno.env.get("DASHBOARD_DIAS_PROYECCION") ?? 30),

  // config -> umbrales riesgo por defecto
  umbralesRiesgoPorDefecto: {
    notaRiesgo: 60,
    asistenciaRiesgo: 75,
    notaRiesgoAlto: 50,
    asistenciaRiesgoAlto: 60,
    // config -> banda observacion
    asistenciaObservacion: 85,
  },

  academicServiceUrl: Deno.env.get("ACADEMIC_SERVICE_URL") ?? "http://localhost:8881",
  internalToken: Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push",
} as const;
