/**
 * Configuración del dashboard. Es un servicio de SOLO LECTURA: nada aquí
 * decide reglas de negocio, sólo cuánto se cachea y a quién se le responde.
 */
export const dashboardConfig = {
  /**
   * Segundos de vida de una proyección cacheada. El dashboard se refresca
   * seguido y las agregaciones son caras, así que se tolera una ventana
   * corta de desactualización. Poner 0 desactiva la caché por completo.
   */
  cacheTtl: Number(Deno.env.get("DASHBOARD_CACHE_TTL") ?? 60),

  /** Periodo mostrado cuando el cliente no manda `periodoId`. */
  periodoPorDefecto: Deno.env.get("PERIODO_POR_DEFECTO") ?? "activo",

  /** Días que se consideran "próximos" para la proyección de cobranza. */
  diasProyeccion: Number(Deno.env.get("DASHBOARD_DIAS_PROYECCION") ?? 30),

  /**
   * Umbrales de riesgo por defecto. Se sobrescriben con los que publique
   * ServiceAcademic en /seguimiento/umbrales, para no duplicar ese criterio.
   */
  umbralesRiesgoPorDefecto: {
    notaRiesgo: 60,
    asistenciaRiesgo: 75,
    notaRiesgoAlto: 50,
    asistenciaRiesgoAlto: 60,
    /**
     * Banda de observación. Tiene que quedar por encima de
     * `asistenciaRiesgo`: si fuera menor, ese tramo nunca se mostraría.
     * ServiceAcademic lo publica como `umbralAsistenciaObservacion`.
     */
    asistenciaObservacion: 85,
  },

  academicServiceUrl: Deno.env.get("ACADEMIC_SERVICE_URL") ?? "http://localhost:8881",
  internalToken: Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push",
} as const;
