import { apiRequest, buildQuery, safe } from './client';

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
  estudiante_id?: number;
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
  async listPlanos(params: {
    periodo_id?: number;
    nivel?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: { plan: PlanPago; cuotas_pendientes: number }[]; total: number }> {
    return safe('[billingApi.listPlanos]', () => apiRequest(`/api/planos${buildQuery(params)}`), { data: [], total: 0 });
  },

  async getPlan(id: number): Promise<PlanPago | null> {
    return safe('[billingApi.getPlan]', () => apiRequest<PlanPago>(`/api/planos/${id}`), null);
  },

  async createPlan(data: Omit<PlanPago, 'id' | 'fecha_creacion' | 'estado'>): Promise<PlanPago | null> {
    return safe('[billingApi.createPlan]', () => apiRequest<PlanPago>('/api/planos', { method: 'POST', body: data }), null);
  },

  async updatePlan(id: number, data: Partial<PlanPago>): Promise<PlanPago | null> {
    return safe('[billingApi.updatePlan]', () => apiRequest<PlanPago>(`/api/planos/${id}`, { method: 'PUT', body: data }), null);
  },

  async deletePlan(id: number): Promise<boolean> {
    return safe('[billingApi.deletePlan]', async () => {
      await apiRequest(`/api/planos/${id}`, { method: 'DELETE' });
      return true;
    }, false);
  },

  async listCuotas(planId: number): Promise<CuotaPlanPago[]> {
    return safe('[billingApi.listCuotas]', () => apiRequest<CuotaPlanPago[]>(`/api/cuotas${buildQuery({ plan_id: planId })}`), []);
  },

  async updateCuota(id: number, estado: CuotaPlanPago['estado']): Promise<boolean> {
    return safe('[billingApi.updateCuota]', async () => {
      await apiRequest(`/api/cuotas/${id}`, { method: 'PUT', body: { estado } });
      return true;
    }, false);
  },

  async listPagos(estudianteId: number): Promise<PagoRealizado[]> {
    return safe('[billingApi.listPagos]', () => apiRequest<PagoRealizado[]>(`/api/pagos${buildQuery({ estudiante_id: estudianteId })}`), []);
  },

  async registrarPago(data: {
    estudianteId: number;
    monto: number;
    metodo: string;
    numeroTransaccion?: string;
    comprobanteUrl?: string;
    registradoPor?: number;
  }): Promise<{ pago: PagoRealizado } | null> {
    return safe('[billingApi.registrarPago]', () => apiRequest<{ pago: PagoRealizado }>('/api/pagos', { method: 'POST', body: data }), null);
  },

  async getDeudaEstudiante(estudianteId: number): Promise<EstudianteDeuda | null> {
    return safe('[billingApi.getDeudaEstudiante]', () => apiRequest<EstudianteDeuda>(`/api/estudiantes/${estudianteId}/deuda`), null);
  },

  async getDeudaEstudiantesPeriodo(periodoId: number): Promise<DeudaEstudiantePeriodo[]> {
    return safe('[billingApi.getDeudaEstudiantesPeriodo]', () => apiRequest<DeudaEstudiantePeriodo[]>(`/api/periodos/${periodoId}/DeudaEstudiantes`), []);
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
