// tipos -> compartidos por todos los modulos academicos
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
