/**
 * Modelo central de notificaciones del sistema.
 *
 * Este servicio es el ÚNICO dueño de las notificaciones: las lee, las crea y
 * las marca como leídas. Los campos `materiaNombre`, `profesorNombre`,
 * `cursoParalelo`, `publicoTexto`, `fechaLimite`, `asignacionId`,
 * `cursoPeriodoId`, `itemId` y `textoPlano` se conservan porque el frontend
 * (NotificationsModal / NotificationsInboxCard) los sigue pintando. Las
 * notificaciones de otros dominios (materias, horarios, usuarios) los dej-an
 * vacíos y se apoyan en `mensaje` + `titulo`.
 */

export type NotificationPriority = "baja" | "media" | "alta" | "critica";

export type NotificationChannel = "sistema" | "academico" | "usuarios" | "horarios";

/** Quién debe recibir la notificación. */
export type NotificationAudience = "usuario" | "curso" | "rol" | "todos";

/** Origen del evento que la originó, p. ej. "materiales.create". */
export type NotificationOrigen = string;

export interface NotificationItem {
  id: string;

  /** Clave funcional: material, actividad, calificacion, horario, usuario… */
  tipo: string;
  canal: NotificationChannel;
  prioridad: NotificationPriority;

  titulo: string;
  mensaje: string;
  /** Versión multilínea lista para notifications push / correo. */
  textoPlano: string;

  // ── Contexto académico (opcional) ────────────────────────────────────────
  materiaNombre?: string;
  profesorNombre?: string;
  cursoParalelo?: string;
  publicoTexto?: string;
  fechaLimite?: string | null;
  asignacionId?: string;
  cursoPeriodoId?: string;
  itemId?: string;

  /** Servicio y evento que la originaron, útil para depurar. */
  origen: NotificationOrigen;

  fechaCreacion: string;
  leido?: boolean;
}

/** Entrada normalizada que produce el catálogo de reglas. */
export interface NotificationDraft {
  tipo: string;
  canal: NotificationChannel;
  prioridad: NotificationPriority;
  titulo: string;
  mensaje: string;
  textoPlano?: string;
  materiaNombre?: string;
  profesorNombre?: string;
  cursoParalelo?: string;
  publicoTexto?: string;
  fechaLimite?: string | null;
  asignacionId?: string | number;
  cursoPeriodoId?: string | number;
  itemId?: string | number;
  origen: NotificationOrigen;
}

/** Evento de dominio publicado por cualquier servicio en el canal Redis. */
export interface DomainEvent<T = Record<string, unknown>> {
  eventType: string;
  /** Servicio emisor: ServiceAcademic, ServiceHomework, … */
  origen: string;
  payload: T;
  emittedAt?: string;
}

/** Respuesta del endpoint de conteo que consume el badge del frontend. */
export interface NotificationCount {
  total: number;
  noLeidas: number;
}
