export interface PlanPago {
  id: number;
  periodo_id: number;
  nivel: string;
  nombre: string;
  cantidad_cuotas: number;
  monto_total: number;
  monto_cuota: number;
  dia_vencimiento: number;
  estado: "borrador" | "generado" | "anulado";
  fecha_creacion: string;
}

export interface CuotaPlanPago {
  id: number;
  plan_id: number;
  numero: number;
  anio: number;
  mes: number;
  fecha_vencimiento: string;
  monto: number;
  estado: "pendiente" | "pagado" | "anulado";
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
  estado: "pendiente" | "confirmado" | "anulado";
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

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}