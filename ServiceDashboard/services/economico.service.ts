import { query } from "../connects/Database/transaction.ts";
import { dashboardConfig } from "../config/dashboard.config.ts";
import type { ResumenEconomico } from "../models/dashboard.ts";

/**
 * Estimación económica: cobranza real y proyección.
 *
 * Sale de `pensiones` (qué se facturó y cuándo vence), `pagos` +
 * `pago_pensiones` (qué se cobró y a qué cuota se imputó) y `planes_pago`.
 *
 * OJO: esto NO es un módulo de facturación. Es una proyección de lectura para
 * la página de inicio. Los pagos se registran en el módulo económico y
 * ServiceBilling sigue siendo un stub sin trackear.
 *
 * Sólo se considera lo no anulado: una anulación es un flujo distinto al de
 * una deuda impagada y no debe engordar la cartera.
 */
export async function resumenEconomico(periodoId: string): Promise<ResumenEconomico> {
  if (!periodoId) {
    return vacio();
  }

  const dias = dashboardConfig.diasProyeccion;
  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const limiteProyeccion = new Date(hoy.getTime() + dias * 86400000)
    .toISOString()
    .slice(0, 10);
  const inicioMes = `${hoyIso.slice(0, 7)}-01`;

  const [totales, morosidad, porMes, topDeudores, pagosMes] = await Promise.all([
    query<{
      facturado: string;
      cobrado: string;
      pendiente: string;
      vencido: string;
      anulado: string;
    }>(
      `SELECT
         COALESCE(SUM(monto) FILTER (WHERE estado <> 'anulado'), 0) AS facturado,
         COALESCE(SUM(monto) FILTER (WHERE estado = 'pagado'), 0) AS cobrado,
         COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0) AS pendiente,
         COALESCE(SUM(monto) FILTER (WHERE estado = 'vencido'), 0) AS vencido,
         COALESCE(SUM(monto) FILTER (WHERE estado = 'anulado'), 0) AS anulado
       FROM pensiones
       WHERE periodo_id = $1`,
      [periodoId],
    ),
    query<{
      cartera: string;
      estudiantes: string;
      dias: string | null;
    }>(
      `SELECT
         COALESCE(SUM(p.monto), 0) AS cartera,
         COUNT(DISTINCT p.estudiante_id) AS estudiantes,
         AVG(CURRENT_DATE - p.fecha_vencimiento)
           FILTER (WHERE p.fecha_vencimiento < CURRENT_DATE) AS dias
       FROM pensiones p
       WHERE p.periodo_id = $1 AND p.estado = 'vencido'`,
      [periodoId],
    ),
    query<{
      mes: number;
      anio: number;
      facturado: string;
      cobrado: string;
      pendiente: string;
    }>(
      `SELECT
         EXTRACT(MONTH FROM p.fecha_vencimiento)::int AS mes,
         EXTRACT(YEAR FROM p.fecha_vencimiento)::int AS anio,
         COALESCE(SUM(p.monto), 0) AS facturado,
         COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'pagado'), 0) AS cobrado,
         COALESCE(SUM(p.monto) FILTER (WHERE p.estado IN ('pendiente', 'vencido')), 0) AS pendiente
       FROM pensiones p
       WHERE p.periodo_id = $1 AND p.estado <> 'anulado'
       GROUP BY 1, 2
       ORDER BY 2, 1`,
      [periodoId],
    ),
    query<{
      estudiante_id: bigint;
      nombre: string;
      apellido_paterno: string;
      deuda: string;
      cuotas: string;
      atraso: string | null;
    }>(
      `SELECT
         p.estudiante_id,
         u.nombre, u.apellido_paterno,
         SUM(p.monto) AS deuda,
         COUNT(*) AS cuotas,
         MAX(CURRENT_DATE - p.fecha_vencimiento) AS atraso
       FROM pensiones p
       JOIN estudiantes e ON e.id = p.estudiante_id
       JOIN usuarios u ON u.id = e.usuario_id
       WHERE p.periodo_id = $1 AND p.estado IN ('pendiente', 'vencido')
       GROUP BY p.estudiante_id, u.nombre, u.apellido_paterno
       ORDER BY SUM(p.monto) DESC
       LIMIT 10`,
      [periodoId],
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(pg.monto), 0) AS total
       FROM pagos pg
       JOIN pago_pensiones pp ON pp.pago_id = pg.id
       JOIN pensiones pe ON pe.id = pp.pension_id
       WHERE pe.periodo_id = $1
         AND pg.estado = 'confirmado'
         AND pg.fecha_pago >= $2::date`,
      [periodoId, inicioMes],
    ),
  ]);

  const t = totales.rows[0];
  const facturado = Number(t?.facturado ?? 0);
  const cobrado = Number(t?.cobrado ?? 0);
  const pendiente = Number(t?.pendiente ?? 0);
  const vencido = Number(t?.vencido ?? 0);

  const proyeccion = await query<{ proximos: string; resto: string }>(
    `SELECT
       COALESCE(SUM(monto) FILTER (
         WHERE estado IN ('pendiente', 'vencido')
           AND fecha_vencimiento BETWEEN CURRENT_DATE AND $2::date
       ), 0) AS proximos,
       COALESCE(SUM(monto) FILTER (
         WHERE estado IN ('pendiente', 'vencido')
           AND fecha_vencimiento > $2::date
       ), 0) AS resto
     FROM pensiones
     WHERE periodo_id = $1 AND estado <> 'anulado'`,
    [periodoId, limiteProyeccion],
  );

  const m = morosidad.rows[0];
  const estudiantesConDeuda = Number(m?.estudiantes ?? 0);
  const carteraVencida = Number(m?.cartera ?? 0);

  return {
    moneda: "BOB",
    facturado,
    cobrado,
    pendiente,
    vencido,
    anulado: Number(t?.anulado ?? 0),
    porcentajeCobranza: facturado > 0
      ? Math.round((cobrado / facturado) * 1000) / 10
      : null,
    proyectado: {
      proximos30Dias: Number(proyeccion.rows[0]?.proximos ?? 0),
      restoDelPeriodo: Number(proyeccion.rows[0]?.resto ?? 0),
      diasProyeccion: dias,
    },
    morosidad: {
      carteraVencida,
      estudiantesConDeuda,
      deudaPromedio: estudiantesConDeuda > 0
        ? Math.round((carteraVencida / estudiantesConDeuda) * 100) / 100
        : 0,
      antiguedadPromedioDias: m?.dias !== null && m?.dias !== undefined
        ? Math.round(Number(m.dias))
        : null,
    },
    porMes: porMes.rows.map((fila) => ({
      mes: Number(fila.mes),
      anio: Number(fila.anio),
      facturado: Number(fila.facturado),
      cobrado: Number(fila.cobrado),
      pendiente: Number(fila.pendiente),
    })),
    topDeudores: topDeudores.rows.map((fila) => ({
      estudianteId: String(fila.estudiante_id),
      nombre: fila.nombre,
      apellidoPaterno: fila.apellido_paterno,
      deuda: Number(fila.deuda),
      cuotasPendientes: Number(fila.cuotas),
      diasAtraso: fila.atraso !== null ? Number(fila.atraso) : null,
    })),
    ingresoMesActual: Number(pagosMes.rows[0]?.total ?? 0),
  };
}

function vacio(): ResumenEconomico {
  return {
    moneda: "BOB",
    facturado: 0,
    cobrado: 0,
    pendiente: 0,
    vencido: 0,
    anulado: 0,
    porcentajeCobranza: null,
    proyectado: { proximos30Dias: 0, restoDelPeriodo: 0, diasProyeccion: dashboardConfig.diasProyeccion },
    morosidad: {
      carteraVencida: 0,
      estudiantesConDeuda: 0,
      deudaPromedio: 0,
      antiguedadPromedioDias: null,
    },
    porMes: [],
    topDeudores: [],
    ingresoMesActual: 0,
  };
}
