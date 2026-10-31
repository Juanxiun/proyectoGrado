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

// ── Materias y maya curricular por GRADO ─────────────────────────────────────
// 1°A y 1°B cursan lo mismo, así que la materia y el temario se configuran una
// sola vez a nivel de grado. Los paralelos siguen siendo cursos aparte para
// horarios, inscripciones y asignaciones.

export interface MateriaDelGrado {
  materiaId: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  pesoSintactico: number;
  tipoMateria: 'principal' | 'extracurricular';
  cargaHorariaSemanal: number;
  orden: number;
}

/** Bloque de "Cursos base": un grado con todos sus paralelos juntos. */
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

export interface ListaGrados {
  conMaterias: GradoConParalelos[];
  sinMaterias: GradoSinMaterias[];
}

export interface TemaMalla {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  materiaId: string;
  materia?: { codigo: string; nombre: string; tipoMateria: 'principal' | 'extracurricular' };
  unidad: number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas: number;
  esEvaluacion: boolean;
  orden: number;
}

/** La maya de un grado: una entrada por materia, con sus temas ya ordenados. */
export interface MayaPorMateria {
  materia: MateriaDelGrado;
  temas: TemaMalla[];
}

export interface ResumenMalla {
  materias: number;
  conTemas: number;
  totalTemas: number;
  horasPrevistas: number;
}

export type NivelEducativo = 'inicial' | 'primaria' | 'secundaria' | 'bachillerato';

const gradoQuery = (nivel: NivelEducativo, grado: string, extra: Record<string, string> = {}) =>
  buildQuery({ nivel, grado, ...extra });

/**
 * Trae todas las páginas de un listado y las devuelve aplanadas.
 *
 * Los tres servicios topan `limit` en 100 por pedido (`Math.min(100, ...)` en
 * `utils/http.ts` de cada uno) sin avisar, así que un `limit: 200` se queda
 * en 100 y cualquier conteo o filtro sobre la lista sale mal. Esto recorre las
 * páginas hasta cubrirlas todas.
 */
async function listAll(
  resource: ServiceResource,
  params: Record<string, string | number | undefined> = {},
): Promise<Record<string, unknown>[]> {
  const porPagina = 100;
  const primera = await academicServicesApi.list(resource, { ...params, page: 1, limit: porPagina });
  const totalPaginas = Math.max(1, Number((primera as { totalPages?: number }).totalPages ?? 1));
  if (totalPaginas <= 1) return primera.data ?? [];

  const resto = await Promise.all(
    Array.from({ length: totalPaginas - 1 }, (_, i) =>
      academicServicesApi.list(resource, { ...params, page: i + 2, limit: porPagina }),
    ),
  );
  return [...(primera.data ?? []), ...resto.flatMap((p) => p.data ?? [])];
}

export const academicServicesApi = {
  list: (
    resource: ServiceResource,
    params: Record<string, string | number | undefined> = {},
  ) =>
    apiRequest<Page>(
      `${paths[resource]}${buildQuery({ page: 1, limit: 100, ...params })}`,
    ),

  /** Igual que `list`, pero recorre todas las páginas y las aplana. */
  listAll,
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

  // ── Materias por grado ─────────────────────────────────────────────────────
  listGrados: (nivel?: NivelEducativo) =>
    apiRequest<ListaGrados>(`/api/grados${buildQuery({ nivel })}`),
  gradoMaterias: (nivel: NivelEducativo, grado: string) =>
    apiRequest<MateriaDelGrado[]>(`/api/grados/materias${gradoQuery(nivel, grado)}`),
  agregarMateriaGrado: (
    nivel: NivelEducativo,
    grado: string,
    payload: { materiaId: string; tipoMateria?: 'principal' | 'extracurricular'; cargaHorariaSemanal?: number },
  ) =>
    apiRequest<MateriaDelGrado[]>(`/api/grados/materias${gradoQuery(nivel, grado)}`, {
      method: 'POST',
      body: payload,
    }),
  quitarMateriaGrado: (nivel: NivelEducativo, grado: string, materiaId: string) =>
    apiRequest<MateriaDelGrado[]>(`/api/grados/materias/${materiaId}${gradoQuery(nivel, grado)}`, {
      method: 'DELETE',
    }),
  setMateriasGrado: (
    nivel: NivelEducativo,
    grado: string,
    materias: Array<{ materiaId: string; tipoMateria?: 'principal' | 'extracurricular'; cargaHorariaSemanal?: number }>,
  ) =>
    apiRequest<MateriaDelGrado[]>(`/api/grados/materias${gradoQuery(nivel, grado)}`, {
      method: 'PUT',
      body: { materias },
    }),

  // ── Maya curricular: temas por grado y materia ─────────────────────────────
  getMalla: (nivel: NivelEducativo, grado: string) =>
    apiRequest<MayaPorMateria[]>(`/api/malla${gradoQuery(nivel, grado)}`),
  getResumenMalla: (nivel: NivelEducativo, grado: string) =>
    apiRequest<ResumenMalla>(`/api/malla/resumen${gradoQuery(nivel, grado)}`),
  getMallaMateria: (nivel: NivelEducativo, grado: string, materiaId: string) =>
    apiRequest<TemaMalla[]>(`/api/malla/materia${gradoQuery(nivel, grado, { materiaId })}`),
  guardarMallaMateria: (
    nivel: NivelEducativo,
    grado: string,
    materiaId: string,
    temas: Array<Partial<TemaMalla> & { titulo: string }>,
  ) =>
    apiRequest<TemaMalla[]>(`/api/malla/materia${gradoQuery(nivel, grado, { materiaId })}`, {
      method: 'PUT',
      body: { temas },
    }),
  crearTema: (
    nivel: NivelEducativo,
    grado: string,
    payload: { materiaId: string; titulo: string; contenidos?: string | null; horasPrevistas?: number; esEvaluacion?: boolean; unidad?: number },
  ) =>
    apiRequest<TemaMalla>(`/api/malla/tema${gradoQuery(nivel, grado)}`, {
      method: 'POST',
      body: payload,
    }),
  actualizarTema: (id: string, payload: Record<string, unknown>) =>
    apiRequest<TemaMalla>(`/api/malla/tema/${id}`, { method: 'PUT', body: payload }),
  eliminarTema: (id: string) =>
    apiRequest<{ message: string }>(`/api/malla/tema/${id}`, { method: 'DELETE' }),
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
