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

export interface TrimestreInput {
  numero: 1 | 2 | 3;
  inicio: string;
  fin: string;
}

export interface GestionTrimestre extends TrimestreInput {
  id: string;
  periodoId: string;
}

export interface DeleteGestionResult {
  id: string;
  nombre: string;
  cursos: number;
  inscripciones: number;
  estudiantes: number;
  pensiones: number;
  pagos: number;
  horarios: number;
  asignaciones: number;
  materiales: number;
  encargos: number;
  notas: number;
  asistencia: number;
  planes: number;
  message?: string;
}

export interface EstadoGestion {
  id: string;
  anio: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  inicioGestion: string;
  finGestion: string;
  estado: 'borrador' | 'configuracion' | 'activo' | 'cerrado' | 'cancelado';
  estructuraGenerada: boolean;
  horariosGenerados: boolean;
  planPagosGenerado: boolean;
  activo: boolean;
  trimestres?: GestionTrimestre[];
  totalCursos: number;
  totalHorarios: number;
  totalPlanes: number;
  conflictos: string[];
  listoParaActivar: boolean;
  bloqueos: string[];
}

export const academicManagementApi = {
  listPeriods: (params: Record<string, string | number | undefined> = {}) =>
    apiRequest<Page>(`/api/periodos${buildQuery({ page: 1, limit: 100, ...params })}`),
  getState: (periodoId: string) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/estado`),
  create: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/api/periodos', { method: 'POST', body: payload }),
  clone: (sourcePeriodoId: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(`/api/periodos/${sourcePeriodoId}/clonar`, { method: 'POST', body: payload }),
  generateStructure: (periodoId: string, payload: Record<string, unknown> = {}) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/generar-estructura`, { method: 'POST', body: payload }),
  generateSchedule: (periodoId: string, payload: Record<string, unknown> = {}) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/generar-horarios`, { method: 'POST', body: payload }),
  saveManualSchedule: (periodoId: string, payload: { cursoPeriodoId: string | number; slots: Array<Record<string, unknown>> }) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/horarios/manual`, { method: 'POST', body: payload }),
  generatePaymentPlan: (periodoId: string, payload: Record<string, unknown>) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/generar-plan-pagos`, { method: 'POST', body: payload }),
  activate: (periodoId: string) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/activar`, { method: 'POST' }),
  deactivate: (periodoId: string) =>
    apiRequest<EstadoGestion>(`/api/periodos/${periodoId}/desactivar`, { method: 'POST' }),
  deletePeriod: (periodoId: string) =>
    apiRequest<DeleteGestionResult>(`/api/periodos/${periodoId}`, { method: 'DELETE' }),
  listTrimesters: (periodoId: string) =>
    apiRequest<GestionTrimestre[]>(`/api/trimestres${buildQuery({ periodoId })}`),
  listSchedules: (periodoId: string, filters: Record<string, string | number | undefined> = {}) =>
    apiRequest<Record<string, unknown>[]>(`/api/horarios${buildQuery({ periodoId, ...filters })}`),
  listCurriculum: (periodoId: string) =>
    apiRequest<Record<string, unknown>[]>(`/api/mallas-curriculares${buildQuery({ periodoId })}`),
  saveCurriculumEntry: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/api/mallas-curriculares', { method: 'POST', body: payload }),
  listPaymentPlans: (periodoId: string) =>
    apiRequest<Record<string, unknown>[]>(`/api/planes-pago${buildQuery({ periodoId })}`),
  listAulas: () => apiRequest<Record<string, unknown>[]>('/api/aulas'),
  createAula: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/api/aulas', { method: 'POST', body: payload }),
  listEnrollmentRequests: () => apiRequest<Record<string, unknown>[]>('/api/inscripciones/solicitudes'),
  createEnrollmentRequest: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>('/api/inscripciones/solicitud', { method: 'POST', body: payload }),
  enableEnrollment: (cursoPeriodoId: string) =>
    apiRequest<Record<string, unknown>>('/api/inscripciones/habilitar', { method: 'POST', body: { cursoPeriodoId } }),
  approveEnrollmentRequest: (id: string) =>
    apiRequest<Record<string, unknown>>(`/api/inscripciones/solicitudes/${id}/aprobar`, { method: 'PATCH' }),
  rejectEnrollmentRequest: (id: string, observacion?: string) =>
    apiRequest<Record<string, unknown>>(`/api/inscripciones/solicitudes/${id}/rechazar`, { method: 'PATCH', body: { observacion } }),
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
  updateMaterialWithFile: (id: string, data: FormData) =>
    apiRequest<Record<string, unknown>>(`${paths.materiales}/${id}`, {
      method: "PUT",
      body: data,
    }),
  uploadEntrega: (data: FormData) =>
    apiRequest<Record<string, unknown>>(paths.entregas, {
      method: "POST",
      body: data,
    }),
};
