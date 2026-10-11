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
  const visibility = viewerRole !== "director" && viewerRole !== "control" ? `AND p."estado" = 'generado'` : "";
  const result = await query<PlanPago>(
    `SELECT p.id, p."periodo_id", p.nivel, p.nombre, p."cantidad_cuotas", p."monto_total", p."monto_cuota", p."dia_vencimiento", p.estado, p."fecha_creacion"
     FROM "planes_pago" p WHERE p.id = $1 ${visibility}`,
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
       COALESCE(SUM(pe.monto) FILTER (WHERE pe.estado IN ('pendiente', 'vencido')), 0)::float8 AS total_deuda,
       COUNT(pe.id) FILTER (WHERE pe.estado IN ('pendiente', 'vencido'))::int AS cuotas_pendientes,
       MAX(pe."fecha_vencimiento") FILTER (WHERE pe.estado IN ('pendiente', 'vencido')) AS ultima_cuota_vencimiento,
       MAX(pe.plan_pago_id) AS plan_id
     FROM estudiantes e
     JOIN usuarios u ON u.id = e.usuario_id
     LEFT JOIN pensiones pe ON pe.estudiante_id = e.id
     WHERE e.id = $1
     GROUP BY e.id, u.nombre, u."apellido_paterno", u."apellido_materno"`,
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

export async function getEconomyKpis(periodoId?: number) {
  const result = await query<Record<string, number>>(
    `WITH periodo AS (
       SELECT COALESCE($1::bigint, (SELECT id FROM periodos_academicos WHERE activo = true LIMIT 1),
                       (SELECT MAX(id) FROM periodos_academicos WHERE estado <> 'cancelado')) AS id
     ), estudiantes AS (
       SELECT e.id, COUNT(pe.id) FILTER (WHERE pe.estado IN ('pendiente', 'vencido'))::int AS pendientes
       FROM periodo p JOIN inscripciones i ON i.periodo_id = p.id AND i.estado = 'activo'
       JOIN estudiantes e ON e.id = i.estudiante_id AND e.estado = 'activo'
       LEFT JOIN pensiones pe ON pe.estudiante_id = e.id AND pe.periodo_id = i.periodo_id
       GROUP BY e.id
     ), ingresos AS (
       SELECT COUNT(*)::int AS pagos_mes_actual, COALESCE(SUM(monto), 0)::float8 AS monto_recaudado_mes
       FROM pagos WHERE estado = 'confirmado' AND fecha_pago >= date_trunc('month', CURRENT_DATE)
         AND fecha_pago < date_trunc('month', CURRENT_DATE) + interval '1 month'
     ), deuda AS (
       SELECT COALESCE(SUM(pe.monto), 0)::float8 AS monto_pendiente
       FROM periodo p JOIN pensiones pe ON pe.periodo_id = p.id
       WHERE pe.estado IN ('pendiente', 'vencido')
     )
     SELECT (SELECT COUNT(*)::int FROM estudiantes) AS total_estudiantes,
            ingresos.pagos_mes_actual, ingresos.monto_recaudado_mes, deuda.monto_pendiente,
            COUNT(*) FILTER (WHERE estudiantes.pendientes = 0)::int AS estudiantes_al_dia,
            COUNT(*) FILTER (WHERE estudiantes.pendientes = 1)::int AS estudiantes_una_cuota,
            COUNT(*) FILTER (WHERE estudiantes.pendientes >= 2)::int AS estudiantes_deudores
     FROM ingresos CROSS JOIN deuda LEFT JOIN estudiantes ON true
     GROUP BY ingresos.pagos_mes_actual, ingresos.monto_recaudado_mes, deuda.monto_pendiente`,
    [periodoId ?? null],
  );
  return result.rows[0] ?? {
    total_estudiantes: 0, pagos_mes_actual: 0, monto_recaudado_mes: 0, monto_pendiente: 0,
    estudiantes_al_dia: 0, estudiantes_una_cuota: 0, estudiantes_deudores: 0,
  };
}

export async function listEconomyStudents(options: {
  periodoId?: number; nivel?: string; grado?: string; paralelo?: string;
  filtroDeuda?: string; estudianteId?: number; page: number; limit: number;
}) {
  const params: unknown[] = [options.periodoId ?? null, options.nivel ?? null,
    options.grado ?? null, options.paralelo ?? null, options.estudianteId ?? null,
    options.filtroDeuda ?? "todos"];
  const base = `WITH periodo AS (
      SELECT COALESCE($1::bigint, (SELECT id FROM periodos_academicos WHERE activo = true LIMIT 1),
                      (SELECT MAX(id) FROM periodos_academicos WHERE estado <> 'cancelado')) AS id
    ), base_estudiantes AS (
      SELECT e.id, u.nombre, u."apellido_paterno", u."apellido_materno",
             c.nivel, c.grado, c.paralelo, i.periodo_id, p.id AS plan_id, p.nombre AS plan_nombre,
             COALESCE(deuda.cuotas_pendientes, 0)::int AS cuotas_pendientes,
             COALESCE(deuda.total_deuda, 0)::float8 AS total_deuda,
             COALESCE(deuda.cuotas_pagadas, 0)::int AS cuotas_pagadas,
             COALESCE(deuda.monto_pagado, 0)::float8 AS monto_pagado, deuda.ultima_cuota_vencimiento
      FROM periodo per JOIN inscripciones i ON i.periodo_id = per.id AND i.estado = 'activo'
      JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id AND cp.estado = 'activo'
      JOIN cursos c ON c.id = cp.curso_id
      JOIN estudiantes e ON e.id = i.estudiante_id AND e.estado = 'activo'
      JOIN usuarios u ON u.id = e.usuario_id
      LEFT JOIN planes_pago p ON p.periodo_id = i.periodo_id AND lower(p.nivel) = lower(c.nivel) AND p.estado = 'generado'
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE pe.estado IN ('pendiente', 'vencido'))::int AS cuotas_pendientes,
               COALESCE(SUM(pe.monto) FILTER (WHERE pe.estado IN ('pendiente', 'vencido')), 0) AS total_deuda,
               COUNT(*) FILTER (WHERE pe.estado = 'pagado')::int AS cuotas_pagadas,
               COALESCE(SUM(pe.monto) FILTER (WHERE pe.estado = 'pagado'), 0) AS monto_pagado,
               MAX(pe.fecha_vencimiento) FILTER (WHERE pe.estado IN ('pendiente', 'vencido')) AS ultima_cuota_vencimiento
        FROM pensiones pe WHERE pe.estudiante_id = e.id AND pe.periodo_id = i.periodo_id
      ) deuda ON true
    ), filtrados AS (
      SELECT * FROM base_estudiantes e
      WHERE ($2::text IS NULL OR lower(e.nivel) = lower($2))
        AND ($3::text IS NULL OR lower(e.grado) = lower($3))
        AND ($4::text IS NULL OR lower(e.paralelo) = lower($4))
        AND ($5::bigint IS NULL OR e.id = $5)
        AND ($6 = 'todos' OR ($6 = 'al_dia' AND e.cuotas_pendientes = 0)
          OR ($6 = 'una_cuota' AND e.cuotas_pendientes = 1)
          OR ($6 = 'deudores' AND e.cuotas_pendientes >= 2))
    )`;
  const count = await query<{ total: number }>(`${base} SELECT COUNT(*)::int AS total FROM filtrados`, params);
  const rows = await query<Record<string, unknown>>(
    `${base} SELECT id, periodo_id, nombre, apellido_paterno, apellido_materno, nivel, grado, paralelo,
       plan_id, plan_nombre, cuotas_pendientes, total_deuda, cuotas_pagadas, monto_pagado,
       ultima_cuota_vencimiento,
       CASE WHEN cuotas_pendientes = 0 THEN 'al_dia' WHEN cuotas_pendientes = 1 THEN 'una_cuota' ELSE 'deudor' END AS estado
     FROM filtrados ORDER BY nivel, grado, paralelo, apellido_paterno, nombre LIMIT $7 OFFSET $8`,
    [...params, options.limit, (options.page - 1) * options.limit],
  );
  return { data: rows.rows, total: Number(count.rows[0]?.total ?? 0), page: options.page, limit: options.limit };
}

export async function getEconomyStudentDetail(estudianteId: number) {
  const students = await listEconomyStudents({ estudianteId, page: 1, limit: 1, filtroDeuda: "todos" });
  const estudiante = students.data[0];
  if (!estudiante) return null;
  const [planResult, cuotasResult, pagos] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, periodo_id, nivel, nombre, cantidad_cuotas, monto_total, monto_cuota,
              dia_vencimiento, estado, fecha_creacion FROM planes_pago WHERE id = $1`,
      [estudiante.plan_id ?? 0],
    ),
    query<Record<string, unknown>>(
      `SELECT id, COALESCE(plan_pago_id, 0) AS plan_id, COALESCE(numero_cuota, 0)::int AS numero,
              EXTRACT(YEAR FROM fecha_vencimiento)::int AS anio,
              COALESCE(mes, EXTRACT(MONTH FROM fecha_vencimiento)::int) AS mes,
              fecha_vencimiento, monto::float8 AS monto,
              CASE WHEN estado = 'vencido' THEN 'pendiente' ELSE estado END AS estado
       FROM pensiones WHERE estudiante_id = $1 AND periodo_id = $2 ORDER BY fecha_vencimiento`,
      [estudianteId, estudiante.periodo_id],
    ),
    listPagosEstudiante(estudianteId),
  ]);
  return { estudiante, plan: planResult.rows[0] ?? null, cuotas: cuotasResult.rows, pagos };
}
