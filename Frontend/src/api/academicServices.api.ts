import { apiRequest, buildQuery } from "./client";

export interface Page<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ServiceResource =
  | "periodos"
  | "cursos"
  | "materias"
  | "cursos-periodo"
  | "inscripciones"
  | "asignaciones"
  | "asesores"
  | "materiales"
  | "encargos"
  | "calificaciones"
  | "asistencia"
  | "entregas";

const paths: Record<ServiceResource, string> = {
  periodos: "/api/periodos",
  cursos: "/api/cursos",
  materias: "/api/materias",
  "cursos-periodo": "/api/cursos-periodo",
  inscripciones: "/api/inscripciones",
  asignaciones: "/api/asignaciones",
  asesores: "/api/asesores",
  materiales: "/api/materiales",
  encargos: "/api/encargos",
  calificaciones: "/api/calificaciones",
  asistencia: "/api/asistencia",
  entregas: "/api/entregas",
};

export const academicServicesApi = {
  list: (
    resource: ServiceResource,
    params: Record<string, string | number | undefined> = {},
  ) =>
    apiRequest<Page>(
      `${paths[resource]}${buildQuery({ page: 1, limit: 100, ...params })}`,
    ),
  create: (resource: ServiceResource, payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(paths[resource], {
      method: "POST",
      body: payload,
    }),
  update: (
    resource: ServiceResource,
    id: string,
    payload: Record<string, unknown>,
  ) =>
    apiRequest<Record<string, unknown>>(`${paths[resource]}/${id}`, {
      method: "PUT",
      body: payload,
    }),
  remove: (resource: ServiceResource, id: string) =>
    apiRequest<void>(`${paths[resource]}/${id}`, { method: "DELETE" }),
  withdraw: (id: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(
      `${paths.inscripciones}/${id}/retirar`,
      { method: "PATCH", body: payload },
    ),
  bulk: (
    resource: "calificaciones" | "asistencia",
    payload: Record<string, unknown>,
  ) =>
    apiRequest<Record<string, unknown>>(`${paths[resource]}/bulk`, {
      method: "POST",
      body: payload,
    }),
  uploadMaterial: (data: FormData) =>
    apiRequest<Record<string, unknown>>(paths.materiales, {
      method: "POST",
      body: data,
    }),
  uploadEntrega: (data: FormData) =>
    apiRequest<Record<string, unknown>>(paths.entregas, {
      method: "POST",
      body: data,
    }),
};
