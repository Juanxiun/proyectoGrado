import { NotificationService } from "./notification.service.ts";
import { broadcastNotification } from "./gateway.service.ts";
import type { DomainEvent, NotificationDraft } from "../models/notification.ts";
import { REGLAS } from "./reglas/catalogo.ts";
import { construirCurso, numero, type ReglaNotificacion } from "./reglas/types.ts";

const INDICE = new Map(REGLAS.map((r) => [r.evento.toLowerCase(), r]));

export function eventosRegistrados(): string[] {
  return REGLAS.map((r) => r.evento);
}

export function tieneRegla(eventType: string): boolean {
  return INDICE.has(String(eventType ?? "").trim().toLowerCase());
}

// notificaciones -> resolucion paralela de destinatarios por audiencia
async function resolverDestinatarios(
  regla: ReglaNotificacion,
  payload: Record<string, unknown>,
): Promise<string[]> {
  switch (regla.audiencia) {
    case "usuario":
      return (await regla.usuarios?.(payload)) ?? [];

    case "rol":
      return NotificationService.resolveUsuariosPorRol(regla.roles ?? []);

    case "curso": {
      const asignacionId = regla.asignacion?.(payload);
      const cursoPeriodoId = regla.cursoPeriodo?.(payload) ??
        await construirCurso(payload, asignacionId);

      if (cursoPeriodoId) {
        return NotificationService.resolveCursoStudents(cursoPeriodoId);
      }

      const periodoId = regla.cursosDelPeriodo?.(payload);
      if (!periodoId) return [];

      const cursos = await NotificationService.resolveCursosDelPeriodoConHorarios(periodoId);
      const listas = await Promise.all(
        cursos.map((curso) => NotificationService.resolveCursoStudents(curso)),
      );
      return [...new Set(listas.flat())];
    }

    default:
      return [];
  }
}

// notificaciones -> despacho de eventos de dominio a usuarios o difusion
export async function procesarEvento(evento: DomainEvent): Promise<void> {
  const eventType = String(evento?.eventType ?? "").trim();
  const regla = INDICE.get(eventType.toLowerCase());
  if (!regla) return;

  const payload = (evento.payload ?? {}) as Record<string, unknown>;
  const draft: NotificationDraft = {
    tipo: regla.tipo,
    canal: regla.canal,
    prioridad: regla.prioridad,
    titulo: regla.titulo(payload),
    mensaje: regla.mensaje(payload),
    origen: `${evento.origen || "desconocido"}:${eventType}`,
  };

  if (regla.audiencia === "curso") {
    const asignacionId = regla.asignacion?.(payload);
    if (asignacionId) {
      const info = await NotificationService.resolveAsignacion(asignacionId);
      if (info) {
        draft.materiaNombre = info.materiaNombre;
        draft.profesorNombre = info.profesorNombre;
        draft.cursoParalelo = info.cursoParalelo;
        draft.cursoPeriodoId = info.cursoPeriodoId;
        draft.asignacionId = asignacionId;
        draft.publicoTexto = regla.tipo === "material" ? "Material académico" : "Actividad nueva";
      }
    }
    const cursoPeriodoId = regla.cursoPeriodo?.(payload);
    if (cursoPeriodoId && !draft.cursoPeriodoId) draft.cursoPeriodoId = cursoPeriodoId;
  }

  if (regla.audiencia === "usuario" && draft.tipo !== "seguridad") {
    const usuarioId = numero(payload.usuarioId) ?? numero(payload.sub);
    if (usuarioId) draft.itemId = usuarioId;
  }

  if (regla.audiencia === "todos") {
    const notif = await NotificationService.sendToAll(draft);
    broadcastNotification(notif);
    console.log(`[Reglas] ${eventType} → difusión a toda la institución`);
    return;
  }

  const destinatarios = await resolverDestinatarios(regla, payload);
  if (destinatarios.length === 0) return;

  await NotificationService.deliverToUsers(destinatarios, draft);
  console.log(`[Reglas] ${eventType} → ${destinatarios.length} destinatario(s)`);
}
