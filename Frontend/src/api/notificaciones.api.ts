import { apiRequest } from './client';

/**
 * Bandeja de notificaciones.
 *
 * La-central de notificaciones vive en ServiceNotification (puerto 8884); el
 * gateway expone `/api/notificaciones` y lo sirve en tiempo real por el hub
 * SignalR. Este módulo sólo habla con el gateway: nunca con el servicio directo.
 */
export interface NotificationItem {
  id: string;

  /** material, actividad, calificacion, horario, materia, usuario, seguridad… */
  tipo: string;
  canal: 'sistema' | 'academico' | 'usuarios' | 'horarios';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';

  titulo: string;
  mensaje: string;
  textoPlano: string;

  /** Contexto académico; presente en materiales, encargos y calificaciones. */
  materiaNombre?: string;
  profesorNombre?: string;
  cursoParalelo?: string;
  publicoTexto?: string;
  fechaLimite?: string | null;
  asignacionId?: string;
  cursoPeriodoId?: string;
  itemId?: string;

  /** "ServiceHomework:materiales.create" */
  origen: string;

  fechaCreacion: string;
  leido?: boolean;
}

export interface NotificationCount {
  total: number;
  noLeidas: number;
}

export const notificacionesApi = {
  async list(usuarioId?: string | number, unreadOnly = false, limit = 50): Promise<NotificationItem[]> {
    try {
      const params = new URLSearchParams();
      if (usuarioId) params.append('usuarioId', String(usuarioId));
      if (unreadOnly) params.append('unreadOnly', 'true');
      params.append('limit', String(limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<NotificationItem[]>(`/api/notificaciones${qs}`);
      return Array.isArray(res) ? res : (res as any)?.data ?? [];
    } catch (err) {
      console.warn('[notificacionesApi.list]', err);
      return [];
    }
  },

  async getUnread(usuarioId?: string | number): Promise<NotificationItem[]> {
    return this.list(usuarioId, true);
  },

  /** Conteo para el badge del encabezado; más barato que traer la bandeja. */
  async count(usuarioId?: string | number): Promise<NotificationCount> {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<NotificationCount>(`/api/notificaciones/conteo${qs}`);
      return { total: res?.total ?? 0, noLeidas: res?.noLeidas ?? 0 };
    } catch (err) {
      console.warn('[notificacionesApi.count]', err);
      return { total: 0, noLeidas: 0 };
    }
  },

  async get(notifId: string, usuarioId?: string | number): Promise<NotificationItem | null> {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      return await apiRequest<NotificationItem>(`/api/notificaciones/${notifId}${qs}`);
    } catch (err) {
      console.warn('[notificacionesApi.get]', err);
      return null;
    }
  },

  async markAsRead(notifId: string, usuarioId?: string | number): Promise<boolean> {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean }>(`/api/notificaciones/${notifId}/read${qs}`, {
        method: 'POST',
      });
      return Boolean(res?.success);
    } catch (err) {
      console.warn('[notificacionesApi.markAsRead]', err);
      return false;
    }
  },

  async markAllAsRead(usuarioId?: string | number): Promise<number> {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean; marcadas: number }>(
        `/api/notificaciones/leer-todas${qs}`,
        { method: 'POST' },
      );
      return res?.marcadas ?? 0;
    } catch (err) {
      console.warn('[notificacionesApi.markAllAsRead]', err);
      return 0;
    }
  },

  async remove(notifId: string, usuarioId?: string | number): Promise<boolean> {
    try {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean }>(`/api/notificaciones/${notifId}${qs}`, {
        method: 'DELETE',
      });
      return Boolean(res?.success);
    } catch (err) {
      console.warn('[notificacionesApi.remove]', err);
      return false;
    }
  },

  /** Eventos del sistema que generan notificación (sólo dirección/control). */
  async reglas(): Promise<string[]> {
    try {
      const res = await apiRequest<{ eventos: string[] }>('/api/notificaciones/reglas');
      return res?.eventos ?? [];
    } catch (err) {
      console.warn('[notificacionesApi.reglas]', err);
      return [];
    }
  },
};
