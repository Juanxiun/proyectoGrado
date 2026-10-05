import { apiRequest, buildQuery } from './client';

export interface PlanPago {
  id: number;
  periodo_id: number;
  nivel: string;
  nombre: string;
  cantidad_cuotas: number;
  monto_total: number;
  monto_cuota: number;
  dia_vencimiento: number;
  estado: 'borrador' | 'generado' | 'anulado';
  fecha_creacion: string;
  cuotas_pendientes?: number;
}

export interface CuotaPlanPago {
  id: number;
  plan_id: number;
  numero: number;
  anio: number;
  mes: number;
  fecha_vencimiento: string;
  monto: number;
  estado: 'pendiente' | 'pagado' | 'anulado';
}

export interface PagoRealizado {
  id: number;
  estudiante_id: number;
  monto: number;
  metodo: string;
  numero_transaccion?: string | null;
  comprobante_url?: string | null;
  fecha_pago: string;
  registrado_por: number;
  estado: 'pendiente' | 'confirmado' | 'anulado';
  observacion?: string | null;
}

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
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string | null;
  nivel: string;
  grado: string;
  paralelo: string;
  plan_id: number;
  plan_nombre: string;
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

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const economiaApi = {
  /**
   * Obtener KPIs generales de economía
   */
  async getKpis(periodoId?: number): Promise<KpisEconomia | null> {
    try {
      return await apiRequest<KpisEconomia>(`/api/economia/kpis${buildQuery({ periodo_id: periodoId })}`);
    } catch (err) {
      console.warn('[economiaApi.getKpis]', err);
      return null;
    }
  },

  /**
   * Listar estudiantes con estado económico agrupados por nivel/grado/paralelo
   */
  async getEstudiantesPorPlan(params: {
    periodo_id?: number;
    nivel?: string;
    grado?: string;
    paralelo?: string;
    filtro_deuda?: 'todos' | 'al_dia' | 'una_cuota' | 'deudores';
  } = {}): Promise<{ data: EstudianteEconomico[]; total: number }> {
    try {
      return await apiRequest(`/api/economia/estudiantes${buildQuery(params)}`);
    } catch (err) {
      console.warn('[economiaApi.getEstudiantesPorPlan]', err);
      return { data: [], total: 0 };
    }
  },

  /**
   * Obtener detalle económico de un estudiante
   */
  async getEstudianteDetalle(estudianteId: number): Promise<{
    estudiante: EstudianteEconomico;
    plan: PlanPago;
    cuotas: CuotaPlanPago[];
    pagos: PagoRealizado[];
  } | null> {
    try {
      return await apiRequest(`/api/economia/estudiantes/${estudianteId}`);
    } catch (err) {
      console.warn('[economiaApi.getEstudianteDetalle]', err);
      return null;
    }
  },

  /**
   * Listar planes de pago con cuotas pendientes
   */
  async listPlanos(params: {
    periodo_id?: number;
    nivel?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: { plan: PlanPago; cuotas_pendientes: number }[]; total: number }> {
    try {
      return await apiRequest(`/api/planos${buildQuery(params)}`);
    } catch (err) {
      console.warn('[economiaApi.listPlanos]', err);
      return { data: [], total: 0 };
    }
  },

  /**
   * Obtener un plan por ID
   */
  async getPlan(id: number): Promise<PlanPago | null> {
    try {
      return await apiRequest<PlanPago>(`/api/planos/${id}`);
    } catch (err) {
      console.warn('[economiaApi.getPlan]', err);
      return null;
    }
  },

  /**
   * Listar cuotas de un plan
   */
  async listCuotas(planId: number): Promise<CuotaPlanPago[]> {
    try {
      return await apiRequest<CuotaPlanPago[]>(`/api/cuotas${buildQuery({ plan_id: planId })}`);
    } catch (err) {
      console.warn('[economiaApi.listCuotas]', err);
      return [];
    }
  },

  /**
   * Listar pagos de un estudiante
   */
  async listPagos(estudianteId: number): Promise<PagoRealizado[]> {
    try {
      return await apiRequest<PagoRealizado[]>(`/api/pagos${buildQuery({ estudiante_id: estudianteId })}`);
    } catch (err) {
      console.warn('[economiaApi.listPagos]', err);
      return [];
    }
  },

  /**
   * Obtener deuda de un estudiante (para vista estudiante)
   */
  async getDeudaEstudiante(estudianteId: number): Promise<EstudianteDeuda | null> {
    try {
      return await apiRequest<EstudianteDeuda>(`/api/estudiantes/${estudianteId}/deuda`);
    } catch (err) {
      console.warn('[economiaApi.getDeudaEstudiante]', err);
      return null;
    }
  },
};

export const MONEDA = 'Bs';

export function formatearMonto(valor: number): string {
  return `${MONEDA} ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(valor)}`;
}

export function getEstadoColor(estado: string): string {
  switch (estado) {
    case 'generado':
    case 'confirmado':
    case 'pagado':
      return 'text-green-600';
    case 'pendiente':
      return 'text-amber-600';
    case 'anulado':
    case 'borrador':
      return 'text-gray-500';
    default:
      return 'text-gray-600';
  }
}

export function getEstadoBadge(estado: string): string {
  switch (estado) {
    case 'generado':
    case 'confirmado':
      return 'bg-green-100 text-green-700';
    case 'pagado':
      return 'bg-green-100 text-green-800';
    case 'pendiente':
      return 'bg-amber-100 text-amber-700';
    case 'anulado':
      return 'bg-gray-100 text-gray-700';
    case 'borrador':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

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