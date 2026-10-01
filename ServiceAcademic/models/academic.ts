export type NivelEducativo = "inicial" | "primaria" | "secundaria" | "bachillerato";

export const NIVELES: readonly NivelEducativo[] = [
  "inicial",
  "primaria",
  "secundaria",
  "bachillerato",
];

export type EstadoPeriodo = "borrador" | "configuracion" | "activo" | "cerrado" | "cancelado";
export type TipoMateria = "principal" | "extracurricular";
export type CodigoTurno = "manana" | "tarde";
export type TipoSolicitudInscripcion = "reserva" | "promocion";

export interface Trimestre {
  id?: string;
  periodoId?: string;
  numero: 1 | 2 | 3;
  inicio: string;
  fin: string;
}

export interface TrimestreInput {
  numero: 1 | 2 | 3;
  inicio: string;
  fin: string;
}

export interface EstructuraNivelInput {
  nivel: NivelEducativo;
  grados?: string[];
  paralelos?: Record<string, number>;
}

export interface GenerarEstructuraInput {
  niveles?: EstructuraNivelInput[];
  paralelosPorNivel?: Record<string, Record<string, number> | string[]>;
  turnoPorNivel?: Record<string, CodigoTurno>;
  capacidadMaxima?: number;
  mallasCurriculares?: MallaCurricularInput[];
  asignaciones?: Array<{
    cursoPeriodoId: string | number;
    materiaId: string | number;
    maestroId: string | number;
  }>;
  turnoPorCurso?: Record<string, CodigoTurno>;
}

export interface MallaCurricularInput {
  nivel: NivelEducativo;
  grado: string;
  materiaId: string | number;
  tipoMateria?: TipoMateria;
  cargaHorariaSemanal?: number;
  pesoSintactico?: number;
}

export interface AulaInput {
  codigo: string;
  nombre: string;
  capacidad?: number;
}

export interface GenerarHorariosInput {
  duracionPeriodoMinutos?: 45 | 50;
  turnosPorCurso?: Record<string, CodigoTurno>;
  turnoPorNivel?: Record<string, CodigoTurno>;
  aulaIds?: string[];
}

export interface GenerarPlanPagoInput {
  montoCuota?: number;
  montoTotal?: number;
  diaVencimiento?: number;
  montosPorNivel?: Partial<Record<NivelEducativo | "general", number>>;
}

export interface PeriodoAcademico {
  id: string;
  anio: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  inicioGestion: string;
  finGestion: string;
  estado: EstadoPeriodo;
  origenPeriodoId?: string | null;
  estructuraGenerada: boolean;
  horariosGenerados: boolean;
  planPagosGenerado: boolean;
  activo: boolean;
  fechaCreacion?: string;
  trimestres?: Trimestre[];
}

export interface CreatePeriodoInput {
  anio: number;
  nombre: string;
  fechaInicio?: string;
  fechaFin?: string;
  inicioGestion?: string;
  finGestion?: string;
  trimestres?: TrimestreInput[];
  inicio1T?: string;
  fin1T?: string;
  inicio2T?: string;
  fin2T?: string;
  inicio3T?: string;
  fin3T?: string;
  inicio1?: string;
  fin1?: string;
  inicio2?: string;
  fin2?: string;
  inicio3?: string;
  fin3?: string;
  modo?: "scratch" | "clone";
  periodoOrigenId?: string | number;
  activo?: boolean;
}

export type UpdatePeriodoInput = Partial<Omit<CreatePeriodoInput, "trimestres">> & {
  trimestres?: TrimestreInput[];
};

export interface Curso {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima: number;
  activo: boolean;
  caratulaUrl?: string | null;
  /**
   * Materias asignadas a este curso base. En 0 significa que el curso todavía
   * no se cargará al generar una gestión: la interfaz debe advertirlo.
   */
  totalMaterias: number;
}

/** Materia asignada a un grado, compartida por todos sus paralelos. */
export interface MateriaDelGrado {
  materiaId: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  pesoSintactico: number;
  tipoMateria: TipoMateria;
  cargaHorariaSemanal: number;
  orden: number;
}

export interface AsignarMateriaGradoInput {
  materiaId: string | number;
  tipoMateria?: TipoMateria;
  cargaHorariaSemanal?: number;
}

/** Bloque de la vista "Cursos base": un grado con todos sus paralelos juntos. */
export interface GradoConParalelos {
  nivel: NivelEducativo;
  grado: string;
  paralelos: string[];
  totalMaterias: number;
}

export interface GradoSinMaterias {
  nivel: NivelEducativo;
  grado: string;
  paralelos: string[];
}

// ── Maya curricular (temas por grado y materia) ─────────────────────────────

export interface TemaMalla {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  materiaId: string;
  materia?: { codigo: string; nombre: string; tipoMateria: TipoMateria };
  unidad: number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas: number;
  esEvaluacion: boolean;
  orden: number;
}

export interface CrearTemaInput {
  materiaId: string | number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas?: number;
  esEvaluacion?: boolean;
  unidad?: number;
}

export interface CreateCursoInput {
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima?: number;
  activo?: boolean;
  caratulaUrl?: string | null;
}

export type UpdateCursoInput = Partial<CreateCursoInput>;

export interface Materia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoMateria: TipoMateria;
  cargaHorariaSemanal: number;
  pesoSintactico: number;
  materiaPesada: boolean;
  activo: boolean;
  caratulaUrl?: string | null;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface CreateMateriaInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoMateria?: TipoMateria;
  cargaHorariaSemanal?: number;
  pesoSintactico?: number;
  materiaPesada?: boolean;
  activo?: boolean;
  caratulaUrl?: string | null;
}

export type UpdateMateriaInput = Partial<CreateMateriaInput>;

export interface MallaCurricular {
  id: string;
  periodoId: string;
  nivel: NivelEducativo;
  grado: string;
  materiaId: string;
  tipoMateria: TipoMateria;
  cargaHorariaSemanal: number;
  pesoSintactico: number;
  materia?: Materia;
}

export interface Aula {
  id: string;
  codigo: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
}

export interface Turno {
  id: string;
  codigo: CodigoTurno;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  recesoInicio: string;
  recesoFin: string;
  duracionPeriodoMinutos: 45 | 50;
}

export interface HorarioManualSlot {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  materiaId: string | number;
  maestroId?: string | number | null;
  aulaId?: string | number | null;
}

export interface GuardarHorarioManualInput {
  cursoPeriodoId: string | number;
  slots: HorarioManualSlot[];
}

export interface Horario {
  id: string;
  cursoPeriodoId: string;
  materiaId: string;
  asignacionId?: string | null;
  maestroId?: string | null;
  aulaId: string;
  turnoId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  estado: "activo" | "cancelado";
  materia?: Materia;
  aula?: Aula;
  maestro?: { id: string; usuarioId?: string; nombre?: string; apellidoPaterno?: string };
}

export interface CuotaPlanPago {
  id: string;
  planId: string;
  numero: number;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  monto: number;
  estado: "pendiente" | "pagado" | "anulado";
}

export interface PlanPago {
  id: string;
  periodoId: string;
  nivel: string;
  nombre: string;
  cantidadCuotas: number;
  montoTotal: number;
  montoCuota: number;
  diaVencimiento: number;
  estado: "borrador" | "generado" | "anulado";
  cuotas?: CuotaPlanPago[];
}

export interface EstadoGestion extends PeriodoAcademico {
  /**
   * Cursos base que quedaron fuera de la última generación por no tener
   * materias asignadas. Se llenan sólo en la respuesta de generarEstructura.
   */
  cursosSinMaterias?: string[];
  totalCursos: number;
  totalHorarios: number;
  totalPlanes: number;
  conflictos: string[];
  listoParaActivar: boolean;
  bloqueos: string[];
}

export interface SolicitudInscripcion {
  id: string;
  estudianteId: string;
  periodoId: string;
  cursoPeriodoDestinoId: string;
  tipo: TipoSolicitudInscripcion;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo?: string | null;
  fechaSolicitud: string;
  fechaProceso?: string | null;
  observacion?: string | null;
}

// ── Seguimiento académico ───────────────────────────────────────────────────

export type NivelRiesgo = "sin_riesgo" | "observacion" | "riesgo" | "riesgo_alto";

/** Una celda del libro: un estudiante dentro de una materia. */
export interface LineaLibro {
  estudianteId: string;
  usuarioId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;

  /** Promedio ponderado de las tareas calificadas del trimestre (0-100). */
  promedio: number | null;
  /** Suma de las ponderaciones de los encargos que ya tienen nota. */
  pesoAcumulado: number;
  /** Ponderación total de los encargos publicados del trimestre. */
  pesoTotal: number;
  /** Tareas calificadas / tareas publicadas. */
  tareasCalificadas: number;
  tareasPublicadas: number;

  desercion: number | null;

  asistencia: ResumenAsistencia;
  indice: number | null;
  nivelRiesgo: NivelRiesgo;
  observaciones: string[];
}

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  total: number;
  /** Porcentaje de asistencia efectiva (presentes + atrasos + justificadas). */
  tasa: number | null;
}

export interface EncargoLibro {
  id: string;
  titulo: string;
  tipo: string;
  ponderacion: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado: string;
  /** Promedio del curso para este encargo. */
  promedioCurso?: number | null;
}

/** Libro de notas de una materia en un trimestre. */
export interface LibroNotas {
  cursoPeriodoId: string;
  materia: { id: string; nombre: string; codigo: string; tipo: string };
  trimestre: { numero: number; inicio: string; fin: string } | null;
  periodo: { id: string; nombre: string; anio: number };
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  docente?: { maestroId: string; usuarioId: string; nombre: string } | null;
  encargos: EncargoLibro[];
  lineas: LineaLibro[];
  resumen: {
    estudiantes: number;
    promedioCurso: number | null;
    promedioMasAlto: number | null;
    promedioMasBajo: number | null;
    enRiesgo: number;
    enRiesgoAlto: number;
  };
}

/** Desempeño de un estudiante en una materia, para su panel personal. */
export interface DesempenoMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  promedio: number | null;
  indice: number | null;
  asistencia: ResumenAsistencia;
  tareasCalificadas: number;
  tareasPublicadas: number;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
}

/** Panel de desempeño de un curso-periodo completo. */
export interface PanelCurso {
  cursoPeriodoId: string;
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  periodo: { id: string; nombre: string; anio: number };
  estudiantes: number;
  /** Número de materias evaluadas en el curso. */
  totalMaterias: number;
  promedioGeneral: number | null;
  promedioAsistencia: number | null;
  distribucionPromedios: RangoPromedio[];
  materias: DesempenoMateriaResumen[];
  riesgo: { total: number; observacion: number; alto: number };
}

export interface RangoPromedio {
  rango: string;
  minimo: number;
  maximo: number;
  estudiantes: number;
}

export interface DesempenoMateriaResumen {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  promedio: number | null;
  promedioAsistencia: number | null;
  estudiantesEvaluados: number;
  enRiesgo: number;
}

export interface PanelEstudiante {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  cursoParalelo: string;
  indiceGeneral: number | null;
  indiceDesempeno: number | null;
  nivelRiesgo: NivelRiesgo;
  periodos: PanelEstudiantePeriodo[];
}

export interface PanelEstudiantePeriodo {
  periodoId: string;
  nombre: string;
  anio: number;
  promedio: number | null;
  indice: number | null;
  asistencia: ResumenAsistencia;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
  materias: DesempenoMateria[];
}

export interface AlertaRiesgo {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  cursoParalelo: string;
  materia: string;
  promedio: number | null;
  asistencia: number | null;
  nivelRiesgo: NivelRiesgo;
  motivos: string[];
}

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
