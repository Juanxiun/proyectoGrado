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
}

export interface DeudaEstudiantePeriodo {
  estudianteId: number;
  deuda: EstudianteDeuda;
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const billingApi = {
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
      console.warn('[billingApi.listPlanos]', err);
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
      console.warn('[billingApi.getPlan]', err);
      return null;
    }
  },

  /**
   * Crear un nuevo plan de pago
   */
  async createPlan(data: Omit<PlanPago, 'id' | 'fecha_creacion' | 'estado'>): Promise<PlanPago | null> {
    try {
      return await apiRequest<PlanPago>('/api/planos', { method: 'POST', body: data });
    } catch (err) {
      console.warn('[billingApi.createPlan]', err);
      return null;
    }
  },

  /**
   * Actualizar un plan de pago
   */
  async updatePlan(id: number, data: Partial<PlanPago>): Promise<PlanPago | null> {
    try {
      return await apiRequest<PlanPago>(`/api/planos/${id}`, { method: 'PUT', body: data });
    } catch (err) {
      console.warn('[billingApi.updatePlan]', err);
      return null;
    }
  },

  /**
   * Anular un plan de pago
   */
  async deletePlan(id: number): Promise<boolean> {
    try {
      await apiRequest(`/api/planos/${id}`, { method: 'DELETE' });
      return true;
    } catch (err) {
      console.warn('[billingApi.deletePlan]', err);
      return false;
    }
  },

  /**
   * Listar cuotas de un plan
   */
  async listCuotas(planId: number): Promise<CuotaPlanPago[]> {
    try {
      return await apiRequest<CuotaPlanPago[]>(`/api/cuotas${buildQuery({ plan_id: planId })}`);
    } catch (err) {
      console.warn('[billingApi.listCuotas]', err);
      return [];
    }
  },

  /**
   * Actualizar estado de cuota
   */
  async updateCuota(id: number, estado: CuotaPlanPago['estado']): Promise<boolean> {
    try {
      await apiRequest(`/api/cuotas/${id}`, { method: 'PUT', body: { estado } });
      return true;
    } catch (err) {
      console.warn('[billingApi.updateCuota]', err);
      return false;
    }
  },

  /**
   * Listar pagos de un estudiante
   */
  async listPagos(estudianteId: number): Promise<PagoRealizado[]> {
    try {
      return await apiRequest<PagoRealizado[]>(`/api/pagos${buildQuery({ estudiante_id: estudianteId })}`);
    } catch (err) {
      console.warn('[billingApi.listPagos]', err);
      return [];
    }
  },

  /**
   * Registrar un nuevo pago
   */
  async registrarPago(data: {
    estudianteId: number;
    monto: number;
    metodo: string;
    numeroTransaccion?: string;
    comprobanteUrl?: string;
    registradoPor?: number;
  }): Promise<{ pago: PagoRealizado } | null> {
    try {
      return await apiRequest<{ pago: PagoRealizado }>('/api/pagos', { method: 'POST', body: data });
    } catch (err) {
      console.warn('[billingApi.registrarPago]', err);
      return null;
    }
  },

  /**
   * Obtener deuda de un estudiante
   */
  async getDeudaEstudiante(estudianteId: number): Promise<EstudianteDeuda | null> {
    try {
      return await apiRequest<EstudianteDeuda>(`/api/estudiantes/${estudianteId}/deuda`);
    } catch (err) {
      console.warn('[billingApi.getDeudaEstudiante]', err);
      return null;
    }
  },

  /**
   * Obtener estudiantes con deuda >= 2 cuotas en un periodo
   */
  async getDeudaEstudiantesPeriodo(periodoId: number): Promise<DeudaEstudiantePeriodo[]> {
    try {
      return await apiRequest<DeudaEstudiantePeriodo[]>(`/api/periodos/${periodoId}/DeudaEstudiantes`);
    } catch (err) {
      console.warn('[billingApi.getDeudaEstudiantesPeriodo]', err);
      return [];
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