import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import {
  activarGestion,
  crearAula,
  crearGestionPeriodo,
  crearMalla,
  desactivarGestion,
  generarEstructura,
  generarHorarios,
  generarPlanPagos,
  guardarHorariosManual,
  listarAulas,
  listarTrimestres,
  listarHorarios,
  listarMallas,
  listarPlanesPago,
  obtenerEstadoGestion,
} from "../../services/gestion.service.ts";
import type {
  CreatePeriodoInput,
  GenerarEstructuraInput,
  GenerarHorariosInput,
  GenerarPlanPagoInput,
  GuardarHorarioManualInput,
} from "../../models/academic.ts";

export async function clonePeriodo(ctx: Context): Promise<void> {
  try {
    const sourceId = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<CreatePeriodoInput>(ctx);
    respond(ctx, 201, await crearGestionPeriodo({
      ...body,
      modo: "clone",
      periodoOrigenId: sourceId,
    }));
  } catch (err) {
    handleControllerError(ctx, err, "Error al clonar la gestión académica");
  }
}

export async function generateStructure(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<GenerarEstructuraInput>(ctx).catch(() => ({} as GenerarEstructuraInput));
    respond(ctx, 200, await generarEstructura(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar la estructura académica");
  }
}

export async function generateScheduleForPeriod(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<GenerarHorariosInput & { periodoId?: string }>(ctx);
    const id = parseNumericId(body.periodoId ?? routeParam(ctx, "id") ?? "");
    const { periodoId: _ignored, ...input } = body;
    respond(ctx, 200, await generarHorarios(id, input));
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar la grilla de horarios");
  }
}

export async function generateSchedule(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<GenerarHorariosInput>(ctx).catch(() => ({} as GenerarHorariosInput));
    respond(ctx, 200, await generarHorarios(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar la grilla de horarios");
  }
}

export async function postHorarioManual(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id") ?? "");
    const body = await readJsonBody<GuardarHorarioManualInput & { periodoId?: string }>(ctx);
    const periodoId = id || parseNumericId(body.periodoId ?? "");
    respond(ctx, 200, await guardarHorariosManual(periodoId, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al guardar el horario manual");
  }
}

export async function generatePaymentPlanForPeriod(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<GenerarPlanPagoInput & { periodoId?: string }>(ctx);
    const id = parseNumericId(body.periodoId ?? routeParam(ctx, "id") ?? "");
    const { periodoId: _ignored, ...input } = body;
    respond(ctx, 200, await generarPlanPagos(id, input));
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar el plan de pagos");
  }
}

export async function generatePaymentPlan(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const body = await readJsonBody<GenerarPlanPagoInput>(ctx);
    respond(ctx, 200, await generarPlanPagos(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar el plan de pagos");
  }
}

export async function deactivatePeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await desactivarGestion(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al desactivar la gestión académica");
  }
}

export async function activatePeriodo(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await activarGestion(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al activar la gestión académica");
  }
}

export async function getPeriodoEstado(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const estado = await obtenerEstadoGestion(id);
    if (ctx.state.auth?.role === "estudiante" && estado.estado !== "activo") {
      ctx.response.status = 404;
      ctx.response.body = { error: "Gestión académica no encontrada" };
      return;
    }
    respond(ctx, 200, estado);
  } catch (err) {
    handleControllerError(ctx, err, "Error al consultar el estado de la gestión");
  }
}

export async function listTrimestres(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(ctx.request.url.searchParams.get("periodoId") ?? "");
    respond(ctx, 200, await listarTrimestres(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar trimestres");
  }
}

export async function listPeriodoTrimestres(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await listarTrimestres(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar trimestres de la gestión");
  }
}

export async function getPeriodoValidacion(ctx: Context): Promise<void> {
  await getPeriodoEstado(ctx);
}

export async function listHorarios(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(ctx.request.url.searchParams.get("periodoId") ?? "");
    const claims = ctx.state.auth as { sub: string; cursoPeriodoId?: string; maestroId?: string; role?: string };
    const requestedCourse = ctx.request.url.searchParams.get("cursoPeriodoId") ?? undefined;
    const requestedTeacher = ctx.request.url.searchParams.get("maestroId") ?? undefined;
    respond(ctx, 200, await listarHorarios(id, {
      diaSemana: ctx.request.url.searchParams.get("dia") ?? undefined,
      cursoPeriodoId: claims.role === "estudiante" ? claims.cursoPeriodoId : requestedCourse,
      maestroId: claims.role === "profesor" ? (claims.maestroId ?? claims.sub) : requestedTeacher,
      estudianteUsuarioId: claims.role === "estudiante" ? claims.sub : undefined,
    }));
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar horarios");
  }
}

export async function listMallas(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(ctx.request.url.searchParams.get("periodoId") ?? "");
    respond(ctx, 200, await listarMallas(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar la malla curricular");
  }
}

export async function listPlanes(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(ctx.request.url.searchParams.get("periodoId") ?? "");
    respond(ctx, 200, await listarPlanesPago(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar planes de pago");
  }
}

export async function postMalla(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<{
      periodoId: string;
      nivel: "inicial" | "primaria" | "secundaria" | "bachillerato";
      grado: string;
      materiaId: string;
      tipoMateria?: "principal" | "extracurricular";
      cargaHorariaSemanal?: number;
      pesoSintactico?: number;
    }>(ctx);
    const periodoId = parseNumericId(body.periodoId);
    const { periodoId: _ignored, ...malla } = body;
    respond(ctx, 201, await crearMalla(periodoId, malla));
  } catch (err) {
    handleControllerError(ctx, err, "Error al guardar la malla curricular");
  }
}

export async function getAulas(ctx: Context): Promise<void> {
  try {
    respond(ctx, 200, await listarAulas());
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar aulas");
  }
}

export async function postAula(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<{ codigo: string; nombre: string; capacidad?: number }>(ctx);
    respond(ctx, 201, await crearAula(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error al crear aula");
  }
}
