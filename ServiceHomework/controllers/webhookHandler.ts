// controllers/webhookHandler.ts
import { Context } from "@oak/oak";
import { extractBearerToken, getClaimsFromToken } from "../security/auth.ts";
import { sendWebhookCallback } from "../services/webhook.service.ts";
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMateriales,
  updateMaterial,
} from "./materiales.controller.ts";
import {
  createEncargo,
  deleteEncargo,
  getEncargo,
  listEncargos,
  updateEncargo,
} from "./encargos.controller.ts";
import {
  bulkCalificaciones,
  createCalificacion,
  deleteCalificacion,
  getCalificacion,
  listCalificaciones,
  updateCalificacion,
} from "./calificaciones.controller.ts";
import {
  bulkAsistencias,
  createAsistencia,
  deleteAsistencia,
  getAsistencia,
  listAsistencias,
  updateAsistencia,
} from "./asistencia.controller.ts";

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
  // Materiales
  "materiales.list": listMateriales,
  "materiales.get": getMaterial,
  "materiales.create": createMaterial,
  "materiales.update": updateMaterial,
  "materiales.delete": deleteMaterial,

  // Encargos / Tareas
  "encargos.list": listEncargos,
  "encargos.get": getEncargo,
  "encargos.create": createEncargo,
  "encargos.update": updateEncargo,
  "encargos.delete": deleteEncargo,

  // Calificaciones
  "calificaciones.list": listCalificaciones,
  "calificaciones.get": getCalificacion,
  "calificaciones.create": createCalificacion,
  "calificaciones.update": updateCalificacion,
  "calificaciones.delete": deleteCalificacion,
  "calificaciones.bulk": bulkCalificaciones,

  // Asistencia
  "asistencia.list": listAsistencias,
  "asistencia.get": getAsistencia,
  "asistencia.create": createAsistencia,
  "asistencia.update": updateAsistencia,
  "asistencia.delete": deleteAsistencia,
  "asistencia.bulk": bulkAsistencias,
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

      const isWrite = /\.(create|update|delete|bulk)$/.test(eventType);
      if (isWrite && claims.role === "estudiante") {
        resultStatus = 403;
        resultError = "No tiene permisos para modificar datos académicos";
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
          url: new URL(`http://localhost/homework${buildQueryString(payload)}`),
          body: {
            // deno-lint-ignore require-await
            json: async () => bodyPayload,
          },
        },
        params: {
          id: String(payload?.id ?? payload?.params?.id ?? ""),
          asignacionId: String(payload?.asignacionId ?? payload?.params?.asignacionId ?? ""),
          encargoId: String(payload?.encargoId ?? payload?.params?.encargoId ?? ""),
          estudianteId: String(payload?.estudianteId ?? payload?.params?.estudianteId ?? ""),
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
