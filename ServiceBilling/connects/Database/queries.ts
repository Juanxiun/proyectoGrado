import { query } from "./transaction.ts";
import type { PlanPago, CuotaPlanPago, PagoRealizado, EstudianteDeuda } from "../../models/billing.ts";

export async function listPlanosPago(
  viewerRole: string,
  periodoId?: number,
  nivel?: string
): Promise<PlanPago[]> {
  let where = "";
  if (viewerRole !== "director" && viewerRole !== "control") {
    where = " WHERE p.estado = 'generado' ";
  }
  const params: any[] = [];
  if (periodoId) {
    params.push(periodoId);
    where += where ? ` AND p."periodo_id" = $${params.length}` : ` WHERE p."periodo_id" = $${params.length}`;
  }
  if (nivel) {
    params.push(nivel);
    where += where ? ` AND p.nivel = $${params.length}` : ` WHERE p.nivel = $${params.length}`;
  }
  const result = await query<PlanPago>(
    `SELECT p.id, p."periodo_id", p.nivel, p.nombre, p."cantidad_cuotas", p."monto_total", p."monto_cuota", p."dia_vencimiento", p.estado, p."fecha_creacion"
     FROM "planes_pago" p ${where}
     ORDER BY p."periodo_id", p.nivel, p.nombre`,
    params
  );
  return result.rows;
}

export async function getPlanPago(id: number, viewerRole: string): Promise<PlanPago | null> {
  const prefix = viewerRole !== "director" && viewerRole !== "control" ? ` WHERE p."estado" = 'generado'` : "";
  const result = await query<PlanPago>(
    `SELECT p.id, p."periodo_id", p.nivel, p.nombre, p."cantidad_cuotas", p."monto_total", p."monto_cuota", p."dia_vencimiento", p.estado, p."fecha_creacion"
     FROM "planes_pago" p ${prefix} WHERE p.id = $1`,
    [id]
  );
  return result.rows.length ? result.rows[0] : null;
}

export async function listCuotasPlan(planId: number): Promise<CuotaPlanPago[]> {
  const result = await query<CuotaPlanPago>(
    `SELECT cp.id, cp."plan_id", cp.numero, cp.anio, cp.mes, cp."fecha_vencimiento", cp.monto, cp.estado
     FROM "cuotas_plan_pago" cp WHERE cp."plan_id" = $1 ORDER BY cp.numero`,
    [planId]
  );
  return result.rows;
}

export async function getEstudianteDeuda(estudianteId: number): Promise<EstudianteDeuda | null> {
  const result = await query<EstudianteDeuda>(
    `SELECT
       e.id AS estudiante_id,
       u.nombre,
       u."apellido_paterno",
       u."apellido_materno",
       COALESCE(SUM(cp.monto), 0) AS total_deuda,
       COUNT(CASE WHEN cp.estado = 'pendiente' THEN 1 END) AS cuotas_pendientes,
       MAX(cp."fecha_vencimiento") AS ultima_cuota_vencimiento,
       MAX(p.id) AS plan_id
     FROM estudiantes e
     JOIN usuarios u ON u.id = e.usuario_id
     LEFT JOIN "cuotas_plan_pago" cp ON cp.estado = 'pendiente'
     LEFT JOIN "planes_pago" p ON p.id = cp."plan_id"
     WHERE e.id = $1
     GROUP BY e.id, u.nombre, u."apellido_paterno", u."apellido_materno`,
    [estudianteId]
  );
  return result.rows.length ? result.rows[0] : null;
}

export async function listPagosEstudiante(estudianteId: number): Promise<PagoRealizado[]> {
  const result = await query<PagoRealizado>(
    `SELECT p.id, p."estudiante_id", p.monto, p.metodo, p."numero_transaccion", p."comprobante_url", p."fecha_pago", p."registrado_por", p.estado, p.observacion
     FROM "pagos" p WHERE p."estudiante_id" = $1 ORDER BY p."fecha_pago" DESC`,
    [estudianteId]
  );
  return result.rows;
}

export async function registrarPago(
  estudianteId: number,
  monto: number,
  metodo: string,
  numeroTransaccion?: string,
  comprobanteUrl?: string,
  registradoPor?: number
): Promise<PagoRealizado> {
  const result = await query<PagoRealizado>(
    `INSERT INTO "pagos" ("estudiante_id", monto, metodo, "numero_transaccion", "comprobante_url", "fecha_pago", "registrado_por", estado, observacion)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, 'confirmado', NULL)
     RETURNING id, "estudiante_id", monto, metodo, "numero_transaccion", "comprobante_url", "fecha_pago", "registrado_por", estado, observacion`,
    [estudianteId, monto, metodo, numeroTransaccion, comprobanteUrl, registradoPor || 0]
  );
  return result.rows[0];
}

export async function actualizarEstadoCuota(cuotaId: number, nuevoEstado: string): Promise<boolean> {
  const result = await query(
    `UPDATE "cuotas_plan_pago" SET estado = $2 WHERE id = $1`,
    [cuotaId, nuevoEstado]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getPlanosPorPeriodo(periodoId: number): Promise<PlanPago[]> {
  const result = await query<PlanPago>(
    `SELECT p.id, p."periodo_id", p.nivel, p.nombre, p."cantidad_cuotas", p."monto_total", p."monto_cuota", p."dia_vencimiento", p.estado, p."fecha_creacion"
     FROM "planes_pago" p WHERE p."periodo_id" = $1 ORDER BY p.nivel, p.nombre`,
    [periodoId]
  );
  return result.rows;
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
  const result = await query<PlanPago>(
    `INSERT INTO "planes_pago" ("periodo_id", nivel, nombre, "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'generado')
     RETURNING id, "periodo_id", nivel, nombre, "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", estado, "fecha_creacion"`,
    [data.periodo_id, data.nivel, data.nombre, data.cantidad_cuotas, data.monto_total, data.monto_cuota, data.dia_vencimiento]
  );
  return result.rows[0];
}

export async function updatePlanPago(id: number, data: Partial<PlanPago>): Promise<PlanPago> {
  const setParts: string[] = [];
  const params: any[] = [id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const colName = key.replace(/([A-Z])/g, '"$1"');
      setParts.push(`${colName} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (setParts.length === 0) {
    throw new Error("No hay campos para actualizar");
  }

  const result = await query<PlanPago>(
    `UPDATE "planes_pago" SET ${setParts.join(", ")} WHERE id = $1
     RETURNING id, "periodo_id", nivel, nombre, "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", estado, "fecha_creacion"`,
    params
  );
  return result.rows[0];
}

export async function deletePlanPago(id: number): Promise<void> {
  await query(
    `UPDATE "planes_pago" SET estado = 'anulado' WHERE id = $1`,
    [id]
  );
}