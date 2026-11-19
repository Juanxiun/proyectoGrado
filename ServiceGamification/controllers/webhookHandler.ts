// webhook -> manejar eventos entrantes
import { Context } from "@oak/oak";
import { handleControllerError, respond } from "../utils/http.ts";
import { publicarEventoAsync } from "../utils/events.ts";
import { gamificationConfig } from "../config/gamification.config.ts";
import { upsertEstudianteGamificacion } from "../services/gamification.service.ts";

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  callbackUrl?: string;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

const EVENT_HANDLERS: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  // eventos -> material procesado
  "content.processed": async (payload) => {
    console.log("[Webhook] Material procesado recibido:", payload.content_id);
    await publicarEventoAsync(gamificationConfig.wsEventos.recompensaGlobal, {
      tipo: "nuevo_contenido",
      contentId: payload.content_id,
      titulo: payload.title,
      materia: payload.subject,
      timestamp: new Date().toISOString(),
    });
  },

  // eventos -> nuevo material
  "materiales.create": async (payload) => {
    console.log("[Webhook] Nuevo material creado:", payload.itemId);
  },

  // eventos -> calificacion creada
  "calificaciones.create": async (payload) => {
    console.log("[Webhook] Calificacion creada:", payload.itemId);
  },

  // eventos -> inscripcion creada
  "inscripciones.create": async (payload) => {
    console.log("[Webhook] Inscripcion creada:", payload.estudianteId);
    if (payload.usuarioId && payload.cursoPeriodoId && payload.paralelo) {
      await upsertEstudianteGamificacion({
        usuarioId: String(payload.usuarioId),
        estudianteId: String(payload.estudianteId),
        cursoPeriodoId: String(payload.cursoPeriodoId),
        paralelo: payload.paralelo as "A" | "B",
        nombre: payload.nombre ? String(payload.nombre) : undefined,
        apellidoPaterno: payload.apellidoPaterno ? String(payload.apellidoPaterno) : undefined,
        avatarUrl: payload.avatarUrl ? String(payload.avatarUrl) : null,
      });
    }
  },

  // eventos -> notificacion leida
  "notificaciones.leer": async (payload) => {
    console.log("[Webhook] Notificacion leida:", payload.notificacionId);
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