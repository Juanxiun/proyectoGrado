export type EstadoAsistencia = "presente" | "ausente" | "atraso" | "justificado";
export const ESTADOS_ASISTENCIA: readonly EstadoAsistencia[] = [
  "presente",
  "ausente",
  "atraso",
  "justificado",
];

export type TipoEvaluacion = "parcial" | "final" | "trimestral" | "bimestral" | "quiz" | "tarea" | "proyecto";
export const TIPOS_EVALUACION: readonly TipoEvaluacion[] = [
  "parcial",
  "final",
  "trimestral",
  "bimestral",
  "quiz",
  "tarea",
  "proyecto",
];

export type TrimestreNumero = 1 | 2 | 3;
export const TRIMESTRES: readonly TrimestreNumero[] = [1, 2, 3];

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// interfaces -> asistencia
export interface Asistencia {
  id: string;
  estudianteId: string;
  asignacionId: string;
  materiaId: string;
  temaId?: string | null;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  horaRegistro?: string | null;
  validadoPorHorario: boolean;
  fechaRegistro: string;
  fechaActualizacion: string;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
  } | null;
  asignacion?: {
    id: string;
    materiaNombre: string;
    cursoPeriodoId: string;
    cursoNombre: string;
    horarioInicio?: string;
    horarioFin?: string;
  } | null;
}

export interface CreateAsistenciaInput {
  estudianteId: string | number;
  asignacionId: string | number;
  materiaId: string | number;
  temaId?: string | number | null;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  horaRegistro?: string | null;
}

export interface UpdateAsistenciaInput {
  estado?: EstadoAsistencia;
  justificacion?: string | null;
}

export interface BulkAsistenciaInput {
  asignacionId: string | number;
  materiaId: string | number;
  fecha: string;
  asistencias: Array<{
    estudianteId: string | number;
    estado: EstadoAsistencia;
    justificacion?: string | null;
    temaId?: string | number | null;
  }>;
}

// interfaces -> calificaciones
export interface CalificacionControl {
  id: string;
  estudianteId: string;
  asignacionId: string;
  materiaId: string;
  temaId?: string | null;
  tipoEvaluacion: TipoEvaluacion;
  trimestre: TrimestreNumero;
  nota: number;
  observacion?: string | null;
  peso: number; // ponderacion 1-100
  fechaEvaluacion: string;
  fechaRegistro: string;
  fechaActualizacion: string;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
  } | null;
  asignacion?: {
    id: string;
    materiaNombre: string;
    cursoPeriodoId: string;
    cursoNombre: string;
  } | null;
  tema?: {
    id: string;
    titulo: string;
    unidad: number;
  } | null;
}

export interface CreateCalificacionInput {
  estudianteId: string | number;
  asignacionId: string | number;
  materiaId: string | number;
  temaId?: string | number | null;
  tipoEvaluacion: TipoEvaluacion;
  trimestre: TrimestreNumero;
  nota: number;
  observacion?: string | null;
  peso?: number;
  fechaEvaluacion?: string;
}

export interface UpdateCalificacionInput {
  nota?: number;
  observacion?: string | null;
  peso?: number;
}

export interface BulkCalificacionInput {
  asignacionId: string | number;
  materiaId: string | number;
  trimestre: TrimestreNumero;
  tipoEvaluacion: TipoEvaluacion;
  calificaciones: Array<{
    estudianteId: string | number;
    nota: number;
    observacion?: string | null;
    peso?: number;
  }>;
}

// interfaces -> temas malla curricular
export interface TemaMallaControl {
  id: string;
  materiaId: string;
  unidad: number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas: number;
  esEvaluacion: boolean;
  orden: number;
  activo: boolean;
  materia?: {
    id: string;
    nombre: string;
    codigo: string;
  } | null;
}

export interface TemaProgreso {
  temaId: string;
  estudianteId: string;
  materiaId: string;
  completado: boolean;
  porcentajeAvance: number;
  calificacionPromedio?: number | null;
  fechaInicio?: string | null;
  fechaCompletado?: string | null;
  notas?: string | null;
}

// interfaces -> examenes parciales
export interface ExamenParcial {
  id: string;
  materiaId: string;
  asignacionId: string;
  cursoPeriodoId: string;
  trimestre: TrimestreNumero;
  titulo: string;
  descripcion?: string | null;
  fechaExamen: string;
  horaInicio: string;
  horaFin: string;
  pesoTotal: number; // suma de pesos de preguntas = 100
  estado: "programado" | "en_curso" | "finalizado" | "cancelado";
  preguntas: PreguntaExamen[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface PreguntaExamen {
  id: string;
  examenId: string;
  enunciado: string;
  tipo: "opcion_multiple" | "verdadero_falso" | "desarrollo" | "completar" | "emparejar";
  opciones?: string[];
  respuestaCorrecta?: string | string[];
  puntaje: number;
  orden: number;
  temaId?: string | null;
}

export interface CreateExamenInput {
  materiaId: string | number;
  asignacionId: string | number;
  cursoPeriodoId: string | number;
  trimestre: TrimestreNumero;
  titulo: string;
  descripcion?: string | null;
  fechaExamen: string;
  horaInicio: string;
  horaFin: string;
  preguntas: Array<Omit<PreguntaExamen, "id" | "examenId">>;
}

export interface RespuestaExamenEstudiante {
  id: string;
  examenId: string;
  estudianteId: string;
  preguntaId: string;
  respuesta: string | string[];
  correcta: boolean;
  puntajeObtenido: number;
  tiempoRespuestaMs?: number | null;
  fechaRespuesta: string;
}

// interfaces -> reportes
export interface ReporteAsistenciaCurso {
  cursoPeriodoId: string;
  cursoNombre: string;
  materiaId: string;
  materiaNombre: string;
  periodo: string;
  totalEstudiantes: number;
  totalClases: number;
  asistencias: Array<{
    estudianteId: string;
    nombreCompleto: string;
    presente: number;
    ausente: number;
    atraso: number;
    justificado: number;
    tasaAsistencia: number;
  }>;
  resumen: {
    promedioAsistencia: number;
    estudiantesEnRiesgo: number; // < 75%
  };
}

export interface ReporteCalificacionesMateria {
  materiaId: string;
  materiaNombre: string;
  cursoPeriodoId: string;
  cursoNombre: string;
  trimestre: TrimestreNumero;
  estudiantes: Array<{
    estudianteId: string;
    nombreCompleto: string;
    notas: Array<{
      tipo: TipoEvaluacion;
      tema?: string;
      nota: number;
      peso: number;
      fecha: string;
    }>;
    promedioPonderado: number;
    promedioTrimestre: number;
    estado: "aprobado" | "reprobado" | "en_riesgo";
  }>;
  estadisticas: {
    promedioCurso: number;
    aprobados: number;
    reprobados: number;
    enRiesgo: number;
    desviacionEstandar: number;
  };
}

export interface ReporteRiesgoEstudiante {
  estudianteId: string;
  nombreCompleto: string;
  cursoPeriodoId: string;
  cursoNombre: string;
  materias: Array<{
    materiaId: string;
    materiaNombre: string;
    promedio: number;
    asistencia: number;
    temasPendientes: number;
    examenesPendientes: number;
    nivelRiesgo: "bajo" | "medio" | "alto" | "critico";
  }>;
  riesgoGeneral: "bajo" | "medio" | "alto" | "critico";
  recomendaciones: string[];
}

export interface FiltroAsistencia {
  asignacionId?: string;
  estudianteId?: string;
  materiaId?: string;
  cursoPeriodoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: EstadoAsistencia;
}

export interface FiltroCalificaciones {
  asignacionId?: string;
  estudianteId?: string;
  materiaId?: string;
  cursoPeriodoId?: string;
  trimestre?: TrimestreNumero;
  tipoEvaluacion?: TipoEvaluacion;
}

export interface FiltroExamenes {
  materiaId?: string;
  asignacionId?: string;
  cursoPeriodoId?: string;
  trimestre?: TrimestreNumero;
  estado?: "programado" | "en_curso" | "finalizado" | "cancelado";
}

export interface EventoControlAcademico {
  tipo: string;
  usuarioId: string;
  estudianteId?: string;
  cursoPeriodoId?: string;
  materiaId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}