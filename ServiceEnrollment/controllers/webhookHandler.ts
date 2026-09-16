// controllers/webhookHandler.ts
import { Context } from "@oak/oak";
import { extractBearerToken, getClaimsFromToken } from "../security/auth.ts";
import { sendWebhookCallback } from "../services/webhook.service.ts";
import {
  createCursoPeriodo,
  deleteCursoPeriodo,
  getCursoPeriodo,
  listCursosPeriodo,
  updateCursoPeriodo,
} from "./cursosPeriodo.controller.ts";
import {
  createInscripcion,
  deleteInscripcion,
  getInscripcion,
  listInscripciones,
  updateInscripcion,
} from "./inscripciones.controller.ts";
import {
  createAsignacion,
  deleteAsignacion,
  getAsignacion,
  listAsignaciones,
  updateAsignacion,
} from "./asignaciones.controller.ts";
import {
  createAsesor,
  deleteAsesor,
  getAsesor,
  listAsesores,
  updateAsesor,
} from "./asesores.controller.ts";

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
  // Cursos Periodo
  "cursosPeriodo.list": listCursosPeriodo,
  "cursos-periodo.list": listCursosPeriodo,
  "cursosPeriodo.get": getCursoPeriodo,
  "cursos-periodo.get": getCursoPeriodo,
  "cursosPeriodo.create": createCursoPeriodo,
  "cursos-periodo.create": createCursoPeriodo,
  "cursosPeriodo.update": updateCursoPeriodo,
  "cursos-periodo.update": updateCursoPeriodo,
  "cursosPeriodo.delete": deleteCursoPeriodo,
  "cursos-periodo.delete": deleteCursoPeriodo,

  // Inscripciones
  "inscripciones.list": listInscripciones,
  "inscripciones.get": getInscripcion,
  "inscripciones.create": createInscripcion,
  "inscripciones.update": updateInscripcion,
  "inscripciones.delete": deleteInscripcion,

  // Asignaciones Docentes
  "asignaciones.list": listAsignaciones,
  "asignaciones.get": getAsignacion,
  "asignaciones.create": createAsignacion,
  "asignaciones.update": updateAsignacion,
  "asignaciones.delete": deleteAsignacion,

  // Asesores de Curso
  "asesores.list": listAsesores,
  "asesores.get": getAsesor,
  "asesores.create": createAsesor,
  "asesores.update": updateAsesor,
  "asesores.delete": deleteAsesor,
};

// deno-lint-ignore no-explicit-any
function buildQueryString(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (
      value !== undefined &&
      value !== null &&
      !["params", "authorization", "token", "headers", "body"].includes(key)
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

      const isWrite = /\.(create|update|delete)$/.test(eventType);
      if (isWrite && !["director", "control"].includes(claims.role)) {
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
          url: new URL(`http://localhost/enrollment${buildQueryString(payload)}`),
          body: {
            // deno-lint-ignore require-await
            json: async () => bodyPayload,
          },
        },
        params: {
          id: String(payload?.id ?? payload?.params?.id ?? ""),
          cursoPeriodoId: String(payload?.cursoPeriodoId ?? payload?.params?.cursoPeriodoId ?? ""),
          estudianteId: String(payload?.estudianteId ?? payload?.params?.estudianteId ?? ""),
          maestroId: String(payload?.maestroId ?? payload?.params?.maestroId ?? ""),
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
