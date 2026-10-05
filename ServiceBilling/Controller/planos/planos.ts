import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import * as billingService from "../../services/deuda.service.ts";
import type { PlanPago, PaginationQuery } from "../../models/billing.ts";

export async function listPlanos(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const viewerRole = String(ctx.state.auth?.role ?? "");
    const periodoId = params.get("periodo_id") ? Number(params.get("periodo_id")!) : undefined;
    const nivel = params.get("nivel") ?? undefined;

    const result = await billingService.listarPlanosConDeuda(viewerRole, periodoId, nivel, pagination);
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar planes de pago");
  }
}

export async function getPlanPago(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const viewerRole = String(ctx.state.auth?.role ?? "");
    const plan = await billingService.getPlanPago(Number(id), viewerRole);
    if (!plan) {
      respond(ctx, 404, { error: "Plan de pago no encontrado" });
      return;
    }
    respond(ctx, 200, plan);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el plan de pago");
  }
}

export async function createPlanPago(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<{
      periodo_id: number;
      nivel: string;
      nombre: string;
      cantidad_cuotas: number;
      monto_total: number;
      monto_cuota: number;
      dia_vencimiento: number;
    }>(ctx);

    const plan = await billingService.createPlanPago(body);
    respond(ctx, 201, plan);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear el plan de pago");
  }
}

export async function updatePlanPago(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<Partial<PlanPago>>(ctx);
    const plan = await billingService.updatePlanPago(Number(id), body);
    respond(ctx, 200, plan);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar el plan de pago");
  }
}

export async function deletePlanPago(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    await billingService.deletePlanPago(Number(id));
    respond(ctx, 200, { message: "Plan de pago anulado correctamente" });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al anular el plan de pago");
  }
}

export async function listCuotasPlan(ctx: Context): Promise<void> {
  try {
    const planId = parseNumericId(ctx.request.url.searchParams.get("plan_id"));
    const cuotas = await billingService.listCuotasPlan(Number(planId));
    respond(ctx, 200, cuotas);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar cuotas del plan");
  }
}

export async function updateCuota(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const body = await readJsonBody<{ estado: string }>(ctx);
    await billingService.actualizarEstadoCuota(Number(id), body.estado);
    respond(ctx, 200, { message: "Estado de cuota actualizado" });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar la cuota");
  }
}

export async function listPagosEstudiante(ctx: Context): Promise<void> {
  try {
    const estudianteId = parseNumericId(ctx.request.url.searchParams.get("estudiante_id"));
    const pagos = await billingService.listPagosEstudiante(Number(estudianteId));
    respond(ctx, 200, pagos);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar pagos del estudiante");
  }
}

export async function registrarPago(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<{
      estudianteId: number;
      monto: number;
      metodo: string;
      numeroTransaccion?: string;
      comprobanteUrl?: string;
      registradoPor?: number;
    }>(ctx);

    const resultado = await billingService.procesarPagoYNotificar(
      body.estudianteId,
      body.monto,
      body.metodo,
      body.numeroTransaccion,
      body.comprobanteUrl,
      body.registradoPor
    );
    respond(ctx, 201, resultado);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al registrar el pago");
  }
}

export async function getDeudaEstudiante(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const viewerRole = String(ctx.state.auth?.role ?? "");
    const deuda = await billingService.calcularDeudaEstudiante(Number(id), viewerRole);

    if (!deuda) {
      respond(ctx, 404, { error: "Estudiante no encontrado o sin deuda" });
      return;
    }

    // control -> estudiante solo ve deuda propia
    if (viewerRole === "estudiante") {
      const authEstudianteId = String(ctx.state.auth?.sub ?? "");
    }

    respond(ctx, 200, deuda);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al calcular la deuda del estudiante");
  }
}

export async function getDeudaEstudiantesPeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id"));
    const viewerRole = String(ctx.state.auth?.role ?? "");
    const deudas = await billingService.verificarDeudaEstudiantesPeriodo(Number(id), viewerRole);
    respond(ctx, 200, deudas);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al verificar deudas del periodo");
  }
}