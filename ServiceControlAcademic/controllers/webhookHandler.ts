// webhook -> manejar eventos entrantes de otros servicios
import { Context } from "@oak/oak";
import { handleControllerError, respond } from "../utils/http.ts";
import { publicarEventoConfig } from "../utils/events.ts";
import { controlAcademicoConfig } from "../config/control-academico.config.ts";

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  callbackUrl?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

const EVENT_HANDLERS: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  // eventos -> desde ServiceAcademicLLMs: material procesado
  "content.processed": async (payload) => {
    console.log("[Webhook] Material procesado recibido:", payload.content_id);
    await publicarEventoConfig("recompensaGlobal", {
      tipo: "nuevo_contenido",
      contentId: payload.content_id,
      titulo: payload.title,
      materia: payload.subject,
      timestamp: new Date().toISOString(),
    });
  },

  // eventos -> desde ServiceHomework: material creado
  "materiales.create": async (payload) => {
    console.log("[Webhook] Nuevo material creado:", payload.itemId);
  },

  // eventos -> desde ServiceAcademic: calificacion creada
  "calificaciones.create": async (payload) => {
    console.log("[Webhook] Calificacion creada:", payload.itemId);
  },

  // eventos -> desde ServiceEnrollment: inscripcion creada
  "inscripciones.create": async (payload) => {
    console.log("[Webhook] Inscripcion creada:", payload.estudianteId);
  },

  // eventos -> desde ServiceNotification: notificacion leida
  "notificaciones.leer": async (payload) => {
    console.log("[Webhook] Notificacion leida:", payload.notificacionId);
  },

  // eventos -> desde ServiceAcademic: horario generado
  "horarios.generados": async (payload) => {
    console.log("[Webhook] Horarios generados para periodo:", payload.periodoId);
  },

  // eventos -> desde ServiceAcademic: malla curricular actualizada
  "malla.actualizada": async (payload) => {
    console.log("[Webhook] Malla actualizada:", payload.materiaId);
  },

  // eventos -> desde ServiceAcademicLLMs: resumen generado
  "resumen.generado": async (payload) => {
    console.log("[Webhook] Resumen generado:", payload.contentId);
  },
};

export async function handleWebhookEvent(ctx: Context): Promise<void> {
  let body: WebhookEvent;
  try {
    body = await ctx.request.body.json();
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Cuerpo de Webhook inválido" };
    return;
  }

  const { eventId, eventType, callbackUrl, payload } = body;

  if (!eventId || !eventType) {
    ctx.response.status = 400;
    ctx.response.body = { error: "eventId y eventType son requeridos" };
    return;
  }

  ctx.response.status = 202;
  ctx.response.body = { queued: true, eventId };

  // procesar async
  (async () => {
    try {
      const handler = EVENT_HANDLERS[eventType];
      if (!handler) {
        console.warn(`[Webhook] Sin handler para eventType: ${eventType}`);
        if (callbackUrl) {
          await fetch(callbackUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ eventId, status: 404, error: "Evento no soportado" }),
          });
        }
        return;
      }

      await handler(payload ?? {});

      if (callbackUrl) {
        await fetch(callbackUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId, status: 200, data: { processed: true } }),
        });
      }
    } catch (err: unknown) {
      console.error(`[WebhookHandler] Error procesando ${eventType} (${eventId}):`, err);
      if (callbackUrl) {
        await fetch(callbackUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventId,
            status: 500,
            error: err instanceof Error ? err.message : "Error interno",
          }),
        });
      }
    }
  })();
}