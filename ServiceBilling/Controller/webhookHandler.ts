import { Context } from "@oak/oak";
import { publicarEvento } from "../utils/events.ts";
import { createPlanPago, getPlanosPorPeriodo } from "../connects/Database/queries.ts";
import type { PlanPago } from "../models/billing.ts";

export async function handleWebhookAcademic(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const { type, payload } = body;

  if (type === "periodo.creado") {
    const periodoId = payload?.periodoId;
    if (periodoId) {
      // webhook -> generar planes periodo
      await generarPlanesParaPeriodo(Number(periodoId));
    }
  } else if (type === "periodo.cerrado") {
    const periodoId = payload?.periodoId;
    if (periodoId) {
      // pendiente -> anular planes periodo
    }
  } else if (type === "estudiante.inscrito") {
    const estudianteId = payload?.estudianteId;
    const periodoId = payload?.periodoId;
    if (estudianteId && periodoId) {
      // pendiente -> crear plan inscripcion
    }
  }
}

async function generarPlanesParaPeriodo(periodoId: number): Promise<void> {
  // funcion -> crear planes por defecto
  const planes = await getPlanosPorPeriodo(periodoId);
  if (planes.length > 0) return;

  const niveles = ["Primaria", "Secundaria"];
  for (const nivel of niveles) {
    await createPlanPago({
      periodo_id: periodoId,
      nivel,
      nombre: `Plan ${nivel} ${new Date().getFullYear()}`,
      cantidad_cuotas: 10,
      monto_total: nivel === "Primaria" ? 5000 : 6000,
      monto_cuota: nivel === "Primaria" ? 500 : 600,
      dia_vencimiento: 10,
    });
  }
}

export async function handleWebhookUser(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const { type, payload } = body;

  if (type === "usuario.created") {
    // pendiente -> plan al inscribir periodo
  }
}

export async function handleWebhookEnrollment(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const { type, payload } = body;

  if (type === "inscripciones.create") {
    const estudianteId = payload?.estudianteId;
    const cursoPeriodoId = payload?.cursoPeriodoId;
    if (estudianteId && cursoPeriodoId) {
      // pendiente -> asociar plan periodo activo
    }
  }
}

export async function handleWebhookHomework(ctx: Context): Promise<void> {
  // webhook -> pagos materiales pendiente
}

export async function handleWebhookDashboard(ctx: Context): Promise<void> {
  // webhook -> dashboard pendiente
}