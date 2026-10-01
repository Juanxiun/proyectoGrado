// controllers/webhookHandler.ts
import { Context } from "@oak/oak";
import { extractBearerToken, getClaimsFromToken } from "../security/auth.ts";
import { sendWebhookCallback } from "../services/webhook.service.ts";
import {
  getAcademico,
  getAsistencia,
  getDashboard,
  getEconomico,
  getPeriodos,
  getRiesgo,
  getUmbralesRiesgo,
  postInvalidarCache,
} from "./dashboard.controller.ts";

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  callbackUrl: string;
  timestamp?: string;
  // deno-lint-ignore no-explicit-any
  payload?: any;
}

type Handler = (ctx: Context) => Promise<void>;

/**
 * El dashboard es de sólo lectura: por eso no expone eventos de escritura.
 * `dashboard.cache.invalidate` es la única excepción y existe para que la
 * interfaz fuerce el recálculo si acaba de generar la estructura de una gestión.
 */
const EVENT_HANDLERS: Record<string, Handler> = {
  "dashboard.get": getDashboard,
  "dashboard.academico": getAcademico,
  "dashboard.asistencia": getAsistencia,
  "dashboard.riesgo": getRiesgo,
  "dashboard.economico": getEconomico,
  "dashboard.periodos": getPeriodos,
  "dashboard.umbrales": getUmbralesRiesgo,
  "dashboard.cache.invalidate": postInvalidarCache,
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

      const mockHeaders = new Headers();
      mockHeaders.set("content-type", "application/json");
      mockHeaders.set("Authorization", `Bearer ${token}`);

      const bodyPayload = payload?.body && typeof payload.body === "object" ? payload.body : payload ?? {};

      // deno-lint-ignore no-explicit-any
      const mockCtx: any = {
        request: {
          headers: mockHeaders,
          url: new URL(`http://localhost/dashboard${buildQueryString(payload)}`),
          body: {
            // deno-lint-ignore require-await
            json: async () => bodyPayload,
          },
        },
        params: {},
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
