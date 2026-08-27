import { Context } from "@oak/oak";
import { login } from "./auth/login.ts";
import { getUsuario, getUsuarios } from "./usuarios/views.ts";
import { createUsuario } from "./usuarios/create.ts";
import { updateUsuario } from "./usuarios/update.ts";
import { deleteUsuario } from "./usuarios/delete.ts";

export interface WebhookEventPayload {
  eventId: string;
  eventType: string;
  callbackUrl: string;
  timestamp?: string;
  // deno-lint-ignore no-explicit-any
  payload?: any;
}

export async function handleWebhookEvent(ctx: Context): Promise<void> {
  let body: WebhookEventPayload;
  try {
    body = await ctx.request.body.json();
  } catch (err) {
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

  // Responder 202 Accepted inmediatamente al RestApi para desacoplar el procesamiento
  ctx.response.status = 202;
  ctx.response.body = { queued: true, eventId };

  // Ejecutar el procesamiento asíncrono en segundo plano y enviar Webhook Callback
  (async () => {
    let resultStatus = 200;
    // deno-lint-ignore no-explicit-any
    let resultData: any = null;
    let resultError: string | null = null;

    try {
      const mockHeaders = new Headers();
      const cType = payload?.contentType || "application/json";
      mockHeaders.set("content-type", cType);

      // Crear un contexto 
      // deno-lint-ignore no-explicit-any
      const mockCtx: any = {
        request: {
          headers: mockHeaders,
          url: new URL(`http://localhost/usuarios${buildQueryString(payload)}`),
          body: {
            // deno-lint-ignore require-await
            json: async () => payload ?? {},
            // deno-lint-ignore require-await
            formData: async () => {
              const formData = new FormData();
              if (payload?.datos) {
                formData.append(
                  "datos",
                  typeof payload.datos === "string" ? payload.datos : JSON.stringify(payload.datos),
                );
              }
              return formData;
            },
          },
        },
        params: {
          id: String(payload?.id ?? payload?.params?.id ?? ""),
          ...((typeof payload === "object" && payload !== null) ? payload : {}),
        },
        response: {
          status: 200,
          body: null,
        },
      };

      switch (eventType) {
        case "auth.login":
        case "login":
          await login(mockCtx);
          break;
        case "usuarios.list":
        case "usuarios:list":
        case "getUsuarios":
          await getUsuarios(mockCtx);
          break;
        case "usuarios.get":
        case "usuarios:get":
        case "getUsuario":
          await getUsuario(mockCtx);
          break;
        case "usuarios.create":
        case "usuarios:create":
        case "createUsuario":
          await createUsuario(mockCtx);
          break;
        case "usuarios.update":
        case "usuarios:update":
        case "updateUsuario":
          await updateUsuario(mockCtx);
          break;
        case "usuarios.delete":
        case "usuarios:delete":
        case "deleteUsuario":
          await deleteUsuario(mockCtx);
          break;
        default:
          mockCtx.response.status = 404;
          mockCtx.response.body = { error: `Acción Webhook desconocida: ${eventType}` };
          break;
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
      console.error(`[WebhookHandler] Error procesando evento ${eventType} (${eventId}):`, err);
      resultStatus = 500;
      resultError = err instanceof Error ? err.message : "Error interno del backend";
    }

    // Enviar Callback vía HTTP POST a callbackUrl del RestApi
    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          status: resultStatus,
          data: resultData,
          error: resultError,
        }),
      });
    } catch (cbErr) {
      console.error(`[WebhookHandler] No se pudo enviar Callback a ${callbackUrl}:`, cbErr);
    }
  })();
}

// deno-lint-ignore no-explicit-any
function buildQueryString(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && key !== "params") {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}
