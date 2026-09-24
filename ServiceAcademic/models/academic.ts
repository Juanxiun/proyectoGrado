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
