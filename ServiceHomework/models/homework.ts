export type EstadoEncargo = "borrador" | "publicado" | "cerrado" | "cancelado";
export const ESTADOS_ENCARGO: readonly EstadoEncargo[] = [
  "borrador",
  "publicado",
  "cerrado",
  "cancelado",
];

export type EstadoAsistencia = "presente" | "ausente" | "atraso" | "justificado";
export const ESTADOS_ASISTENCIA: readonly EstadoAsistencia[] = [
  "presente",
  "ausente",
  "atraso",
  "justificado",
];

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

// ── Materia Materiales ───────────────────────────────────────────────────────
export interface MateriaMaterial {
  id: string;
  asignacionId: string;
  titulo: string;
  detalle?: string | null;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: number | null;
  fechaSubida: string;
  activo: boolean;
  asignacion?: {
    id: string;
    maestroId: string;
    materiaId: string;
    cursoPeriodoId: string;
    materiaNombre?: string;
    materiaCodigo?: string;
  } | null;
}

export interface CreateMateriaMaterialInput {
  asignacionId: string | number;
  titulo: string;
  detalle?: string | null;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: number | null;
  activo?: boolean;
}

export interface UpdateMateriaMaterialInput {
  titulo?: string;
  detalle?: string | null;
  archivoUrl?: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: number | null;
  activo?: boolean;
}

// ── Encargos (Tareas/Exámenes/Proyectos) ─────────────────────────────────────
export interface Encargo {
  id: string;
  asignacionId: string;
  tipo: string;
  titulo: string;
  descripcion?: string | null;
  ponderacion: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado: EstadoEncargo;
  fechaCreacion: string;
  fechaActualizacion: string;
  materiales?: MateriaMaterial[];
  asignacion?: {
    id: string;
    maestroId: string;
    materiaId: string;
    cursoPeriodoId: string;
    materiaNombre?: string;
  } | null;
}

export interface CreateEncargoInput {
  asignacionId: string | number;
  tipo: string;
  titulo: string;
  descripcion?: string | null;
  ponderacion: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado?: EstadoEncargo;
  materialIds?: (string | number)[];
}

export interface UpdateEncargoInput {
  tipo?: string;
  titulo?: string;
  descripcion?: string | null;
  ponderacion?: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado?: EstadoEncargo;
  materialIds?: (string | number)[];
}

// ── Calificaciones ──────────────────────────────────────────────────────────
export interface Calificacion {
  id: string;
  encargoId: string;
  estudianteId: string;
  nota: number;
  observacion?: string | null;
  fechaCalificacion: string;
  fechaActualizacion: string;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
  } | null;
  encargo?: {
    id: string;
    titulo: string;
    tipo: string;
    ponderacion: number;
  } | null;
}

export interface CreateCalificacionInput {
  encargoId: string | number;
  estudianteId: string | number;
  nota: number;
  observacion?: string | null;
}

export interface UpdateCalificacionInput {
  nota?: number;
  observacion?: string | null;
}

export interface BulkCalificacionInput {
  encargoId: string | number;
  calificaciones: Array<{
    estudianteId: string | number;
    nota: number;
    observacion?: string | null;
  }>;
}

// ── Asistencia ──────────────────────────────────────────────────────────────
export interface Asistencia {
  id: string;
  estudianteId: string;
  asignacionId: string;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
  fechaRegistro: string;
  fechaActualizacion: string;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
  } | null;
}

export interface CreateAsistenciaInput {
  estudianteId: string | number;
  asignacionId: string | number;
  fecha: string;
  estado: EstadoAsistencia;
  justificacion?: string | null;
}

export interface UpdateAsistenciaInput {
  estado?: EstadoAsistencia;
  justificacion?: string | null;
}

export interface BulkAsistenciaInput {
  asignacionId: string | number;
  fecha: string;
  asistencias: Array<{
    estudianteId: string | number;
    estado: EstadoAsistencia;
    justificacion?: string | null;
  }>;
}

// ── Entregas de Tareas / Deberes ──────────────────────────────────────────
export type EstadoEntrega = "a_tiempo" | "con_retraso";
export const ESTADOS_ENTREGA: readonly EstadoEntrega[] = [
  "a_tiempo",
  "con_retraso",
];

export interface EncargoEntrega {
  id: string;
  encargoId: string;
  estudianteId: string;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: number | null;
  comentario?: string | null;
  fechaEntrega: string;
  estadoEntrega: EstadoEntrega;
  estudiante?: {
    id: string;
    usuarioId: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
  } | null;
  encargo?: {
    id: string;
    titulo: string;
    tipo: string;
    fechaLimite?: string | null;
    asignacionId?: string;
    materiaNombre?: string;
  } | null;
}

export interface CreateEncargoEntregaInput {
  encargoId: string | number;
  estudianteId?: string | number;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: number | null;
  comentario?: string | null;
}
