import { query } from "../connects/Database/transaction.ts";
import {
  listPlanosPago as listPlanosPagoQuery,
  getPlanPago as getPlanPagoQuery,
  getEstudianteDeuda as getEstudianteDeudaQuery,
  listCuotasPlan as listCuotasPlanQuery,
  listPagosEstudiante as listPagosEstudianteQuery,
  registrarPago as registrarPagoQuery,
  actualizarEstadoCuota as actualizarEstadoCuotaQuery,
  createPlanPago as createPlanPagoQuery,
  updatePlanPago as updatePlanPagoQuery,
  deletePlanPago as deletePlanPagoQuery,
  getPlanosPorPeriodo as getPlanosPorPeriodoQuery,
} from "../connects/Database/queries.ts";
import type { PlanPago, CuotaPlanPago, PagoRealizado, EstudianteDeuda, PaginationQuery } from "../models/billing.ts";
import { publicarEvento } from "../utils/events.ts";

export async function listarPlanosConDeuda(
  viewerRole: string,
  periodoId?: number,
  nivel?: string,
  pagination?: PaginationQuery
): Promise<{ data: { plan: PlanPago; cuotasPendientes: CuotaPlanPago[] }[]; total: number }> {
  const planes = await listPlanosPagoQuery(viewerRole, periodoId, nivel);
  const resultado: { plan: PlanPago; cuotasPendientes: CuotaPlanPago[] }[] = [];

  for (const plan of planes) {
    const cuotas = await listCuotasPlanQuery(plan.id);
    const pendientes = cuotas.filter(c => c.estado === "pendiente");
    resultado.push({ plan, cuotasPendientes: pendientes });
  }

  if (pagination) {
    const start = pagination.offset;
    const end = pagination.offset + pagination.limit;
    return { data: resultado.slice(start, end), total: resultado.length };
  }

  return { data: resultado, total: resultado.length };
}

export async function getPlanPago(id: number, viewerRole: string): Promise<PlanPago | null> {
  return getPlanPagoQuery(id, viewerRole);
}

export async function createPlanPago(data: {
  periodo_id: number;
  nivel: string;
  nombre: string;
  cantidad_cuotas: number;
  monto_total: number;
  monto_cuota: number;
  dia_vencimiento: number;
}): Promise<PlanPago> {
  return createPlanPagoQuery(data);
}

export async function updatePlanPago(id: number, data: Partial<PlanPago>): Promise<PlanPago> {
  return updatePlanPagoQuery(id, data);
}

export async function deletePlanPago(id: number): Promise<void> {
  return deletePlanPagoQuery(id);
}

export async function listCuotasPlan(planId: number): Promise<CuotaPlanPago[]> {
  return listCuotasPlanQuery(planId);
}

export async function actualizarEstadoCuota(cuotaId: number, nuevoEstado: string): Promise<void> {
  await actualizarEstadoCuotaQuery(cuotaId, nuevoEstado);
}

export async function listPagosEstudiante(estudianteId: number): Promise<PagoRealizado[]> {
  return listPagosEstudianteQuery(estudianteId);
}

export async function procesarPagoYNotificar(
  estudianteId: number,
  monto: number,
  metodo: string,
  numeroTransaccion?: string,
  comprobanteUrl?: string,
  registradoPor?: number
): Promise<{ pago: PagoRealizado; deudasActualizadas: boolean }> {
  const pago = await registrarPagoQuery(estudianteId, monto, metodo, numeroTransaccion, comprobanteUrl, registradoPor);

  const deuda = await getEstudianteDeudaQuery(estudianteId);
  const cuotasPendientes = deuda?.cuotas_pendientes ?? 0;
  const tieneMenosDeDos = cuotasPendientes < 2;

  if (deuda && !tieneMenosDeDos) {
    await publicarEvento(
      "cuotas.sobre_limite",
      {
        estudianteId,
        cuotasPendientes: deuda.cuotas_pendientes,
        totalDeuda: deuda.total_deuda,
        planId: deuda.plan_id,
      },
      "ServiceBilling"
    );
  }

  return { pago, deudasActualizadas: true };
}

export async function calcularDeudaEstudiante(
  estudianteId: number,
  _viewerRole: string
): Promise<EstudianteDeuda | null> {
  const deuda = await getEstudianteDeudaQuery(estudianteId);
  if (!deuda) return null;
  return deuda;
}

export async function verificarDeudaEstudiantesPeriodo(
  periodoId: number,
  _viewerRole: string
): Promise<{ estudianteId: number; deuda: EstudianteDeuda }[]> {
  const planes = await getPlanosPorPeriodoQuery(periodoId);
  const resultado: { estudianteId: number; deuda: EstudianteDeuda }[] = [];

  for (const _plan of planes) {
    const estudiantesResult = await query(
      `SELECT e.id
       FROM estudiantes e
       WHERE e."periodo_id" = $1`,
      [periodoId]
    );

    for (const estudiante of estudiantesResult.rows as { id: number }[]) {
      const deuda = await getEstudianteDeudaQuery(estudiante.id);
      if (deuda && deuda.cuotas_pendientes >= 2) {
        resultado.push({ estudianteId: estudiante.id, deuda });
      }
    }
  }

  return resultado;
}