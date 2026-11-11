import { apiRequest, buildQuery, safe } from './client';
import type { CuotaPlanPago, PagoRealizado, PlanPago } from './billing.api';

// economia -> reexporta billing sin duplicar
export { MONEDA, formatearMonto, getEstadoBadge, getEstadoColor } from './billing.api';
export type { CuotaPlanPago, Page, PagoRealizado, PlanPago } from './billing.api';

export interface EstudianteDeuda {
  estudiante_id: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  total_deuda: number;
  cuotas_pendientes: number;
  ultima_cuota_vencimiento?: string | null;
  plan_id?: number;
  nivel?: string;
  grado?: string;
  paralelo?: string;
}

export interface DeudaEstudiantePeriodo {
  estudianteId: number;
  deuda: EstudianteDeuda;
}

export interface EstudianteEconomico {
  id: number;
  periodo_id?: number;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  nivel: string;
  grado: string;
  paralelo: string;
  plan_id: number | null;
  plan_nombre: string | null;
  cuotas_pendientes: number;
  total_deuda: number;
  cuotas_pagadas: number;
  monto_pagado: number;
  ultima_cuota_vencimiento?: string | null;
  estado: 'al_dia' | 'una_cuota' | 'deudor'; // al_dia = 0, una_cuota = 1, deudor = 2+
}

export interface KpisEconomia {
  total_estudiantes: number;
  pagos_mes_actual: number;
  monto_recaudado_mes: number;
  monto_pendiente: number;
  estudiantes_al_dia: number;
  estudiantes_una_cuota: number;
  estudiantes_deudores: number;
}

export const economiaApi = {
  async getKpis(periodoId?: number): Promise<KpisEconomia | null> {
    return safe('[economiaApi.getKpis]', () => apiRequest<KpisEconomia>(`/api/economia/kpis${buildQuery({ periodo_id: periodoId })}`), null);
  },

  async getEstudiantesPorPlan(params: {
    periodo_id?: number;
    nivel?: string;
    grado?: string;
    paralelo?: string;
    filtro_deuda?: 'todos' | 'al_dia' | 'una_cuota' | 'deudores';
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: EstudianteEconomico[]; total: number }> {
    return safe('[economiaApi.getEstudiantesPorPlan]', () => apiRequest(`/api/economia/estudiantes${buildQuery({ limit: 100, ...params })}`), { data: [], total: 0 });
  },

  async getEstudianteDetalle(estudianteId: number): Promise<{
    estudiante: EstudianteEconomico;
    plan: PlanPago | null;
    cuotas: CuotaPlanPago[];
    pagos: PagoRealizado[];
  } | null> {
    return safe('[economiaApi.getEstudianteDetalle]', () => apiRequest(`/api/economia/estudiantes/${estudianteId}`), null);
  },

  async createPlan(data: {
    periodo_id: number;
    nivel: string;
    nombre: string;
    cantidad_cuotas: number;
    monto_total: number;
    monto_cuota: number;
    dia_vencimiento: number;
  }): Promise<PlanPago | null> {
    return safe('[economiaApi.createPlan]', () => apiRequest<PlanPago>('/api/planos', { method: 'POST', body: data }), null);
  },

  async listPlanos(params: {
    periodo_id?: number;
    nivel?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: { plan: PlanPago; cuotas_pendientes: number }[]; total: number }> {
    return safe('[economiaApi.listPlanos]', () => apiRequest(`/api/planos${buildQuery(params)}`), { data: [], total: 0 });
  },

  async getPlan(id: number): Promise<PlanPago | null> {
    return safe('[economiaApi.getPlan]', () => apiRequest<PlanPago>(`/api/planos/${id}`), null);
  },

  async listCuotas(planId: number): Promise<CuotaPlanPago[]> {
    return safe('[economiaApi.listCuotas]', () => apiRequest<CuotaPlanPago[]>(`/api/cuotas${buildQuery({ plan_id: planId })}`), []);
  },

  async listPagos(estudianteId: number): Promise<PagoRealizado[]> {
    return safe('[economiaApi.listPagos]', () => apiRequest<PagoRealizado[]>(`/api/pagos${buildQuery({ estudiante_id: estudianteId })}`), []);
  },

  async getDeudaEstudiante(estudianteId: number): Promise<EstudianteDeuda | null> {
    return safe('[economiaApi.getDeudaEstudiante]', () => apiRequest<EstudianteDeuda>(`/api/estudiantes/${estudianteId}/deuda`), null);
  },
};

export function getDeudaEstado(cuotasPendientes: number): 'al_dia' | 'una_cuota' | 'deudor' {
  if (cuotasPendientes === 0) return 'al_dia';
  if (cuotasPendientes === 1) return 'una_cuota';
  return 'deudor';
}

export function getDeudaBadgeVariant(estado: 'al_dia' | 'una_cuota' | 'deudor'): 'success' | 'warning' | 'danger' {
  switch (estado) {
    case 'al_dia': return 'success';
    case 'una_cuota': return 'warning';
    case 'deudor': return 'danger';
  }
}

export function getDeudaLabel(estado: 'al_dia' | 'una_cuota' | 'deudor'): string {
  switch (estado) {
    case 'al_dia': return 'Al día';
    case 'una_cuota': return '1 cuota';
    case 'deudor': return 'Deudor (2+)';
  }
}
