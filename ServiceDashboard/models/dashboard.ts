// modelos -> contrato dashboard lectura

export type Alcance = "institucion" | "docente" | "propio";

export interface PeriodoRef {
  id: string;
  nombre: string;
  anio: number;
  estado: string;
  activo: boolean;
  trimestre: number;
}

// modelo -> cabecera vistas dashboard
export interface ContextoDashboard {
  periodo: PeriodoRef | null;
  alcance: Alcance;
  // campo -> descripcion alcance
  descripcionAlcance: string;
  generadoEn: string;
  cacheado: boolean;
  // campo -> duracion proyeccion
  duracionMs: number;
}

export interface TarjetaKpi {
  clave: string;
  etiqueta: string;
  valor: number | string | null;
  sufijo?: string;
  detalle?: string;
  icono: string;
  // campo -> marca atencion valor
  alerta?: boolean;
}

// seccion -> modelo academico

export interface AvanceMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  maestro?: string | null;
  encargosPublicados: number;
  encargosCalificados: number;
  // campo -> avance calificacion porcentaje
  avanceCalificacion: number;
  promedio: number | null;
  // campo -> alumnos sin nota
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
  // campo -> estado gestion academica
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

// seccion -> modelo asistencia

export interface ResumenAsistencia {
  registros: number;
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  // campo -> tasa asistencia efectiva
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
    // campo -> maximo faltas materia
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

// seccion -> modelo riesgo

export interface ResumenRiesgo {
  total: number;
  observacion: number;
  riesgo: number;
  riesgoAlto: number;
  sinRiesgo: number;
  // campo -> umbrales aplicados
  umbrales: {
    notaRiesgo: number;
    asistenciaRiesgo: number;
    notaRiesgoAlto: number;
    asistenciaRiesgoAlto: number;
    asistenciaObservacion: number;
  };
  top: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    cursoParalelo: string;
    promedio: number | null;
    asistencia: number | null;
    nivelRiesgo: "observacion" | "riesgo" | "riesgo_alto" | "sin_riesgo";
    motivos: string[];
  }>;
}

// seccion -> modelo economico

export interface ResumenEconomico {
  moneda: string;
  facturado: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  anulado: number;
  // campo -> porcentaje cobranza
  porcentajeCobranza: number | null;
  proyectado: {
    // campo -> cobro proximos dias
    proximos30Dias: number;
    // campo -> saldo resto periodo
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

// seccion -> modelo completo

export interface DashboardCompleto {
  contexto: ContextoDashboard;
  kpis: TarjetaKpi[];
  academico: ResumenAcademico;
  asistencia: ResumenAsistenciaDashboard;
  riesgo: ResumenRiesgo;
  economico: ResumenEconomico | null;
  // campo -> economico oculto docentes
  economicoOculto?: boolean;
}
