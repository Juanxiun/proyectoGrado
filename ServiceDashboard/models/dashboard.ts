/**
 * Contrato del dashboard. Todas las proyecciones se calculan en el momento
 * desde la base compartida y se cachean por un TTL corto; nada se persiste.
 */

export type Alcance = "institucion" | "docente" | "propio";

export interface PeriodoRef {
  id: string;
  nombre: string;
  anio: number;
  estado: string;
  activo: boolean;
  trimestre: number;
}

/** Lo que se responde en la cabecera de cualquier vista del dashboard. */
export interface ContextoDashboard {
  periodo: PeriodoRef | null;
  alcance: Alcance;
  /** Visible sólo para el usuario actual, para explicar el recorte. */
  descripcionAlcance: string;
  generadoEn: string;
  cacheado: boolean;
  /** Milisegundos que tardó la proyección. */
  duracionMs: number;
}

export interface TarjetaKpi {
  clave: string;
  etiqueta: string;
  valor: number | string | null;
  sufijo?: string;
  detalle?: string;
  icono: string;
  /** true cuando el valor merece atención (por ejemplo, cartera vencida). */
  alerta?: boolean;
}

// ── Académico ───────────────────────────────────────────────────────────────

export interface AvanceMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  maestro?: string | null;
  encargosPublicados: number;
  encargosCalificados: number;
  /** 0-100: qué parte de la planificación ya tiene notas cargadas. */
  avanceCalificacion: number;
  promedio: number | null;
  /** Estudiantes sin ninguna nota en esta materia. */
  estudiantesSinNota: number;
  estudiantes: number;
}

export interface ResumenAcademico {
  periodos: PeriodoRef[];
  matricula: {
    total: number;
    porNivel: Array<{ nivel: string; estudiantes: number; cursos: number }>;
  };
  cursos: {
    total: number;
    conDocente: number;
    sinDocente: number;
  };
  materias: {
    total: number;
    conEncargos: number;
    sinEncargos: number;
    avanceGlobal: number;
  };
  /** Progreso de la puesta en marcha de la gestión académica. */
  estadoGestion: {
    estructuraGenerada: boolean;
    horariosGenerados: boolean;
    planPagosGenerado: boolean;
    listoParaActivar: boolean;
  };
 _docente?: {
    cursos: number;
    materias: number;
    estudiantes: number;
  };
  _avance: AvanceMateria[];
}

// ── Asistencia ──────────────────────────────────────────────────────────────

export interface ResumenAsistencia {
  registros: number;
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  /** Porcentaje de asistencia efectiva; null si no hay registros. */
  tasa: number | null;
  diasRegistrados: number;
}

export interface ResumenAsistenciaDashboard {
  global: ResumenAsistencia;
  ultimosDias: Array<{ fecha: string; presentes: number; ausentes: number; tasa: number | null }>;
  porMateria: Array<{
    materiaId: string;
    materia: string;
    cursoParalelo: string;
    total: number;
    ausentes: number;
    tasa: number | null;
    /** Días que faltó el alumno con más ausencias de esa materia. */
    mayorFaltas: number;
  }>;
  estudiantesConMasFaltas: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    cursoParalelo: string;
    ausentes: number;
    justificadas: number;
    total: number;
  }>;
}

// ── Riesgo ──────────────────────────────────────────────────────────────────

export interface ResumenRiesgo {
  total: number;
  observacion: number;
  riesgo: number;
  riesgoAlto: number;
  sinRiesgo: number;
  /** Umbrales aplicados, para que la interfaz pueda explicarlos. */
  umbrales: {
    notaRiesgo: number;
    asistenciaRiesgo: number;
    notaRiesgoAlto: number;
    asistenciaRiesgoAlto: number;
  };
  top: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    cursoParalelo: string;
    promedio: number | null;
    asistencia: number | null;
    nivelRiesgo: "observacion" | "riesgo" | "riesgo_alto";
    motivos: string[];
  }>;
}

// ── Económico ───────────────────────────────────────────────────────────────

export interface ResumenEconomico {
  moneda: string;
  facturado: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  anulado: number;
  /** Porcentaje de cobranza sobre lo facturado. */
  porcentajeCobranza: number | null;
  proyectado: {
    /** A cobrar en los próximos días según vencimientos del plan. */
    proximos30Dias: number;
    /** Lo que queda por vencer en el resto del período. */
    restoDelPeriodo: number;
    diasProyeccion: number;
  };
  morosidad: {
    carteraVencida: number;
    estudiantesConDeuda: number;
    deudaPromedio: number;
    antiguedadPromedioDias: number | null;
  };
  porMes: Array<{
    mes: number;
    anio: number;
    facturado: number;
    cobrado: number;
    pendiente: number;
  }>;
  topDeudores: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    deuda: number;
    cuotasPendientes: number;
    diasAtraso: number | null;
  }>;
  ingresoMesActual: number;
}

// ── Vista completa ──────────────────────────────────────────────────────────

export interface DashboardCompleto {
  contexto: ContextoDashboard;
  kpis: TarjetaKpi[];
  academico: ResumenAcademico;
  asistencia: ResumenAsistenciaDashboard;
  riesgo: ResumenRiesgo;
  economico: ResumenEconomico | null;
  /** Se omite para docentes: la economía no les corresponde. */
  economicoOculto?: boolean;
}
