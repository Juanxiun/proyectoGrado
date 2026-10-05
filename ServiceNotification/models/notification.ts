// archivo -> modelo notificaciones

export type NotificationPriority = "baja" | "media" | "alta" | "critica";

export type NotificationChannel = "sistema" | "academico" | "usuarios" | "horarios";

// tipo -> audiencia notificacion
export type NotificationAudience = "usuario" | "curso" | "rol" | "todos";

// tipo -> origen evento
export type NotificationOrigen = string;

export interface NotificationItem {
  id: string;

  // campo -> tipo funcional
  tipo: string;
  canal: NotificationChannel;
  prioridad: NotificationPriority;

  titulo: string;
  mensaje: string;
  // campo -> texto multilinea
  textoPlano: string;

  // grupo -> contexto academico
  materiaNombre?: string;
  profesorNombre?: string;
  cursoParalelo?: string;
  publicoTexto?: string;
  fechaLimite?: string | null;
  asignacionId?: string;
  cursoPeriodoId?: string;
  itemId?: string;

  // campo -> origen depuracion
  origen: NotificationOrigen;

  fechaCreacion: string;
  leido?: boolean;
}

// interfaz -> borrador notificacion
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

// interfaz -> evento dominio redis
export interface DomainEvent<T = Record<string, unknown>> {
  eventType: string;
  // campo -> servicio emisor
  origen: string;
  payload: T;
  emittedAt?: string;
}

// interfaz -> conteo notificaciones
export interface NotificationCount {
  total: number;
  noLeidas: number;
}
