export type NivelEducativo = "inicial" | "primaria" | "secundaria" | "bachillerato";

export const NIVELES: readonly NivelEducativo[] = [
  "inicial",
  "primaria",
  "secundaria",
  "bachillerato",
];

export interface PeriodoAcademico {
  id: string;
  anio: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  fechaCreacion?: string;
}

export interface CreatePeriodoInput {
  anio: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo?: boolean;
}

export type UpdatePeriodoInput = Partial<CreatePeriodoInput>;

export interface Curso {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima: number;
  activo: boolean;
}

export interface CreateCursoInput {
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima?: number;
  activo?: boolean;
}

export type UpdateCursoInput = Partial<CreateCursoInput>;

export interface Materia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface CreateMateriaInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
}

export type UpdateMateriaInput = Partial<CreateMateriaInput>;

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
