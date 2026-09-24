export type EstadoCursoPeriodo = "activo" | "cerrado" | "cancelado";
export const ESTADOS_CURSO_PERIODO: EstadoCursoPeriodo[] = ["activo", "cerrado", "cancelado"];

export type EstadoInscripcion = "activo" | "retirado" | "finalizado";
export const ESTADOS_INSCRIPCION: EstadoInscripcion[] = ["activo", "retirado", "finalizado"];

export type EstadoAsignacion = "activo" | "finalizado" | "cancelado";
export const ESTADOS_ASIGNACION: EstadoAsignacion[] = ["activo", "finalizado", "cancelado"];

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

export interface CursoPeriodo {
  id: string;
  cursoId: string;
  periodoId: string;
  turnoId?: string | null;
  turnoCodigo?: string;
  turnoNombre?: string;
  capacidadMaxima: number;
  estado: EstadoCursoPeriodo;
  curso?: {
    id: string;
    nivel: string;
    grado: string;
    paralelo: string;
    capacidadMaxima: number;
    activo: boolean;
  } | null;
  periodo?: {
    id: string;
    anio: number;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    inicioGestion?: string;
    finGestion?: string;
    activo: boolean;
    estado?: string;
  } | null;
  totalInscritos?: number;
}

export interface CreateCursoPeriodoInput {
  cursoId: string | number;
  periodoId: string | number;
  capacidadMaxima?: number;
  turnoId?: string | number;
  estado?: EstadoCursoPeriodo;
}

export interface UpdateCursoPeriodoInput {
  capacidadMaxima?: number;
  turnoId?: string | number;
  estado?: EstadoCursoPeriodo;
}

export interface Inscripcion {
  id: string;
  estudianteId: string;
  cursoPeriodoId: string;
  periodoId?: string;
  origen?: "nueva" | "reserva" | "promocion";
  fechaInscripcion: string;
  fechaRetiro?: string | null;
  estado: EstadoInscripcion;
  observacion?: string | null;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
    estado?: string;
  } | null;
  cursoPeriodo?: CursoPeriodo | null;
}

export interface CreateInscripcionInput {
  estudianteId: string | number;
  cursoPeriodoId: string | number;
  fechaInscripcion?: string;
  origen?: "nueva" | "reserva" | "promocion";
  solicitudId?: string | number;
  observacion?: string | null;
}

export type TipoSolicitudInscripcion = "reserva" | "promocion";

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
  enrollmentId?: string;
}

export interface CreateSolicitudInscripcionInput {
  cursoPeriodoDestinoId: string | number;
  tipo: TipoSolicitudInscripcion;
  motivo?: string | null;
}

export interface UpdateInscripcionInput {
  estado?: EstadoInscripcion;
  fechaRetiro?: string | null;
  observacion?: string | null;
}

export interface AsignacionDocente {
  id: string;
  maestroId: string;
  materiaId: string;
  cursoPeriodoId: string;
  estado: EstadoAsignacion;
  fechaAsignacion: string;
  fechaFinalizacion?: string | null;
  maestro?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    especialidad?: string;
  } | null;
  materia?: {
    id: string;
    codigo: string;
    nombre: string;
  } | null;
  cursoPeriodo?: CursoPeriodo | null;
}

export interface CreateAsignacionInput {
  maestroId: string | number;
  materiaId: string | number;
  cursoPeriodoId: string | number;
  estado?: EstadoAsignacion;
}

export interface UpdateAsignacionInput {
  maestroId?: string | number;
  materiaId?: string | number;
  cursoPeriodoId?: string | number;
  estado?: EstadoAsignacion;
  fechaFinalizacion?: string | null;
}

export interface CursoAsesor {
  id: string;
  cursoPeriodoId: string;
  maestroId: string;
  fechaInicio: string;
  fechaFin?: string | null;
  maestro?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  } | null;
  cursoPeriodo?: CursoPeriodo | null;
}

export interface CreateCursoAsesorInput {
  cursoPeriodoId: string | number;
  maestroId: string | number;
  fechaInicio: string;
  fechaFin?: string | null;
}

export interface UpdateCursoAsesorInput {
  maestroId?: string | number;
  fechaInicio?: string;
  fechaFin?: string | null;
}
