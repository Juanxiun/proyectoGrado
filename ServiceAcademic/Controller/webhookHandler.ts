import { Context } from "@oak/oak";
import { extractBearerToken, getClaimsFromToken } from "../security/auth.ts";
import { sendWebhookCallback } from "../services/webhook.service.ts";
import {
  createPeriodo,
  deletePeriodo,
  getPeriodo,
  listPeriodos,
  updatePeriodo,
} from "./periodos/periodos.ts";
import {
  createCurso,
  deleteCurso,
  getCurso,
  listCursos,
  updateCurso,
} from "./cursos/cursos.ts";
import {
  createMateria,
  deleteMateria,
  getMateria,
  listMaterias,
  updateMateria,
} from "./materias/materias.ts";
import {
  activatePeriodo,
  deactivatePeriodo,
  clonePeriodo,
  generatePaymentPlan,
  generatePaymentPlanForPeriod,
  generateSchedule,
  generateScheduleForPeriod,
  generateStructure,
  getPeriodoEstado,
  getPeriodoValidacion,
  getAulas,
  listMallas,
  listHorarios,
  listPlanes,
  listTrimestres,
  postAula,
  postHorarioManual,
  postMalla,
} from "./gestion/gestion.ts";

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  callbackUrl: string;
  timestamp?: string;
  // deno-lint-ignore no-explicit-any
  payload?: any;
}

type Handler = (ctx: Context) => Promise<void>;

const EVENT_HANDLERS: Record<string, Handler> = {
  "periodos.list": listPeriodos,
  "periodos.get": getPeriodo,
  "periodos.create": createPeriodo,
  "periodos.update": updatePeriodo,
  "periodos.delete": deletePeriodo,
  "periodos.estado": getPeriodoEstado,
  "periodos.readiness": getPeriodoEstado,
  "periodos.validacion": getPeriodoValidacion,
  "periodos.validar": getPeriodoValidacion,
  "periodos.clonar": clonePeriodo,
  "periodos.clone": clonePeriodo,
  "periodos.generar-estructura": generateStructure,
  "periodos.generar-cursos": generateStructure,
  "periodos.generar-horarios": generateSchedule,
  "periodos.generar-plan-pagos": generatePaymentPlan,
  "periodos.activar": activatePeriodo,
  "periodos.desactivar": deactivatePeriodo,
  "cursos.list": listCursos,
  "cursos.get": getCurso,
  "cursos.create": createCurso,
  "cursos.update": updateCurso,
  "cursos.delete": deleteCurso,
  "materias.list": listMaterias,
  "materias.get": getMateria,
  "materias.create": createMateria,
  "materias.update": updateMateria,
  "materias.delete": deleteMateria,
  "mallas-curriculares.list": listMallas,
  "mallas-curriculares.create": postMalla,
  "horarios.list": listHorarios,
  "horarios.generate": generateScheduleForPeriod,
  "horarios.manual": postHorarioManual,
  "planes-pago.list": listPlanes,
  "planes-pago.generate": generatePaymentPlanForPeriod,
  "trimestres.list": listTrimestres,
  "aulas.list": getAulas,
  "aulas.create": postAula,
};

// deno-lint-ignore no-explicit-any
function buildQueryString(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (
      value !== undefined &&
      value !== null &&
      !["params", "authToken", "authorization", "token", "headers", "body"].includes(key)
    ) {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export async function handleWebhookEvent(ctx: Context): Promise<void> {
  let body: WebhookEventPayload;
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Cuerpo de Webhook inválido" };
    return;
  }

  const { eventId, eventType, callbackUrl, payload } = body;

  if (!eventId || !eventType || !callbackUrl) {
    ctx.response.status = 400;
    ctx.response.body = { error: "eventId, eventType y callbackUrl son requeridos" };
    return;
  }

  ctx.response.status = 202;
  ctx.response.body = { queued: true, eventId };

  (async () => {
    let resultStatus = 200;
    // deno-lint-ignore no-explicit-any
    let resultData: any = null;
    let resultError: string | null = null;

    try {
      const token = extractBearerToken(
        payload?.authToken ??
          payload?.authorization ??
          payload?.token ??
          payload?.headers?.Authorization ??
          payload?.headers?.authorization,
      );
      const claims = token ? await getClaimsFromToken(token) : null;
      if (!claims) {
        resultStatus = 401;
        resultError = "Token inválido, expirado o sesión inactiva";
        await sendWebhookCallback(callbackUrl, eventId, resultStatus, null, resultError);
        return;
      }

      const isWrite = /\.(create|update|delete|clone|clonar|activar|desactivar|generate|generar-estructura|generar-cursos|generar-horarios|generar-plan-pagos)$/.test(eventType);
      const isManagement = /^periodos\.(estado|readiness|validacion|validar|clonar|clone|activar|desactivar|generar-estructura|generar-cursos|generar-horarios|generar-plan-pagos)$/.test(eventType);
      if ((isWrite || isManagement) && !["director", "control"].includes(claims.role)) {
        resultStatus = 403;
        resultError = "No tiene permisos para esta operación";
        await sendWebhookCallback(callbackUrl, eventId, resultStatus, null, resultError);
        return;
      }
      if (!isWrite && claims.role === "estudiante") {
        resultStatus = 403;
        resultError = "No tiene permisos para esta operación";
        await sendWebhookCallback(callbackUrl, eventId, resultStatus, null, resultError);
        return;
      }

      const mockHeaders = new Headers();
      mockHeaders.set("content-type", "application/json");
      mockHeaders.set("Authorization", `Bearer ${token}`);

      const bodyPayload = payload?.body && typeof payload.body === "object" ? payload.body : payload ?? {};

      // deno-lint-ignore no-explicit-any
      const mockCtx: any = {
        request: {
          headers: mockHeaders,
          url: new URL(`http://localhost/academic${buildQueryString(payload)}`),
          body: {
            // deno-lint-ignore require-await
            json: async () => bodyPayload,
          },
        },
        params: {
          id: String(payload?.id ?? payload?.params?.id ?? payload?.periodoId ?? ""),
          periodoId: String(payload?.periodoId ?? payload?.params?.periodoId ?? ""),
        },
        state: { auth: claims },
        response: {
          status: 200,
          body: null,
        },
      };

      const handler = EVENT_HANDLERS[eventType];
      if (!handler) {
        mockCtx.response.status = 404;
        mockCtx.response.body = { error: `Acción Webhook desconocida: ${eventType}` };
      } else {
        await handler(mockCtx);
      }

      resultStatus = mockCtx.response.status;
      if (resultStatus >= 400) {
        resultError = typeof mockCtx.response.body?.error === "string"
          ? mockCtx.response.body.error
          : "Error en el procesamiento del servicio";
      } else {
        resultData = mockCtx.response.body;
      }
    } catch (err: unknown) {
      console.error(`[WebhookHandler] Error procesando ${eventType} (${eventId}):`, err);
      resultStatus = 500;
      resultError = err instanceof Error ? err.message : "Error interno del backend";
    }

    await sendWebhookCallback(callbackUrl, eventId, resultStatus, resultData, resultError);
  })();
}
