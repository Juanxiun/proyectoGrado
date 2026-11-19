import { Context } from "@oak/oak";
import { NotificationService } from "../services/notification.service.ts";
import { broadcastNotification } from "../services/gateway.service.ts";
import { estadoBusEventos } from "../services/eventBus.service.ts";
import { eventosRegistrados, tieneRegla, procesarEvento } from "../services/reglas.service.ts";
import { HttpError } from "../utils/errors.ts";
import { handleControllerError, readJsonBody, respond } from "../utils/http.ts";
import type {
  NotificationChannel,
  NotificationDraft,
  NotificationPriority,
} from "../models/notification.ts";

interface EmitirBody {
  // campo -> reutiliza regla evento
  evento?: string;
  audiencia?: "usuario" | "curso" | "rol" | "todos";
  usuarioIds?: string[];
  roles?: string[];
  cursoPeriodoId?: string;
  asignacionId?: string;
  destinatarioId?: string;

  titulo?: string;
  mensaje?: string;
  tipo?: string;
  canal?: NotificationChannel;
  prioridad?: NotificationPriority;
  fechaLimite?: string | null;
  itemId?: string;
  cursoParalelo?: string;
  materiaNombre?: string;
  profesorNombre?: string;
  publicoTexto?: string;
}

// funcion -> emitir notificacion directa
export async function emitirNotificacion(ctx: Context): Promise<void> {
  try {
    const body = await readJsonBody<EmitirBody>(ctx);

    if (body.evento && tieneRegla(body.evento)) {
      await procesarEvento({
        eventType: body.evento,
        origen: "ServiceNotification",
        payload: {
          titulo: body.titulo,
          mensaje: body.mensaje,
          usuarioId: body.destinatarioId,
          cursoPeriodoId: body.cursoPeriodoId,
          asignacionId: body.asignacionId,
        },
      });
      respond(ctx, 201, { success: true, viaRegla: body.evento });
      return;
    }

    if (!body.titulo?.trim()) {
      throw new HttpError(400, "titulo es requerido");
    }

    const draft: NotificationDraft = {
      tipo: body.tipo ?? "sistema",
      canal: body.canal ?? "sistema",
      prioridad: body.prioridad ?? "media",
      titulo: body.titulo.trim(),
      mensaje: body.mensaje?.trim() ?? body.titulo.trim(),
      fechaLimite: body.fechaLimite ?? null,
      materiaNombre: body.materiaNombre,
      profesorNombre: body.profesorNombre,
      cursoParalelo: body.cursoParalelo,
      publicoTexto: body.publicoTexto,
      itemId: body.itemId,
      cursoPeriodoId: body.cursoPeriodoId,
      asignacionId: body.asignacionId,
      origen: "ServiceNotification:emitir",
    };

    const audiencia = body.audiencia ?? (body.destinatarioId ? "usuario" : "todos");

    if (audiencia === "todos") {
      const notif = await NotificationService.sendToAll(draft);
      broadcastNotification(notif);
      respond(ctx, 201, { success: true, id: notif.id, audiencia });
      return;
    }

    if (audiencia === "rol") {
      if (!body.roles?.length) throw new HttpError(400, "roles es requerido para audiencia por rol");
      const notif = await NotificationService.sendToRoles(body.roles, draft);
      respond(ctx, 201, { success: true, id: notif.id, audiencia });
      return;
    }

    if (audiencia === "curso") {
      if (!body.cursoPeriodoId) {
        throw new HttpError(400, "cursoPeriodoId es requerido para audiencia por curso");
      }
      const notif = await NotificationService.sendToCourse(body.cursoPeriodoId, draft, body.asignacionId);
      respond(ctx, 201, { success: true, id: notif?.id, audiencia });
      return;
    }

    const usuarioIds = body.usuarioIds?.length
      ? body.usuarioIds
      : body.destinatarioId
      ? [body.destinatarioId]
      : [];

    if (usuarioIds.length === 0) {
      throw new HttpError(400, "usuarioIds o destinatarioId son requeridos para audiencia por usuario");
    }

    const notif = await NotificationService.deliverToUsers(usuarioIds, draft);
    respond(ctx, 201, { success: true, id: notif.id, audiencia });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al emitir la notificación");
  }
}

// funcion -> listar reglas eventos
export async function listarReglas(ctx: Context): Promise<void> {
  try {
    const eventos = eventosRegistrados();
    respond(ctx, 200, { total: eventos.length, eventos });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar las reglas");
  }
}

// funcion -> estado bus eventos
export async function estadoEventos(ctx: Context): Promise<void> {
  try {
    respond(ctx, 200, {
      bus: estadoBusEventos(),
      reglas: eventosRegistrados().length,
    });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al consultar el estado del bus");
  }
}
