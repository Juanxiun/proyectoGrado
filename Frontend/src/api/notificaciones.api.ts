import { apiRequest, safe } from './client';

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
    return safe('[notificacionesApi.list]', async () => {
      const params = new URLSearchParams();
      if (usuarioId) params.append('usuarioId', String(usuarioId));
      if (unreadOnly) params.append('unreadOnly', 'true');
      params.append('limit', String(limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiRequest<NotificationItem[]>(`/api/notificaciones${qs}`);
      return Array.isArray(res) ? res : (res as any)?.data ?? [];
    }, []);
  },

  async getUnread(usuarioId?: string | number): Promise<NotificationItem[]> {
    return this.list(usuarioId, true);
  },

  async count(usuarioId?: string | number): Promise<NotificationCount> {
    return safe('[notificacionesApi.count]', async () => {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<NotificationCount>(`/api/notificaciones/conteo${qs}`);
      return { total: res?.total ?? 0, noLeidas: res?.noLeidas ?? 0 };
    }, { total: 0, noLeidas: 0 });
  },

  async get(notifId: string, usuarioId?: string | number): Promise<NotificationItem | null> {
    return safe('[notificacionesApi.get]', async () => {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      return await apiRequest<NotificationItem>(`/api/notificaciones/${notifId}${qs}`);
    }, null);
  },

  async markAsRead(notifId: string, usuarioId?: string | number): Promise<boolean> {
    return safe('[notificacionesApi.markAsRead]', async () => {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean }>(`/api/notificaciones/${notifId}/read${qs}`, {
        method: 'POST',
      });
      return Boolean(res?.success);
    }, false);
  },

  async markAllAsRead(usuarioId?: string | number): Promise<number> {
    return safe('[notificacionesApi.markAllAsRead]', async () => {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean; marcadas: number }>(
        `/api/notificaciones/leer-todas${qs}`,
        { method: 'POST' },
      );
      return res?.marcadas ?? 0;
    }, 0);
  },

  async remove(notifId: string, usuarioId?: string | number): Promise<boolean> {
    return safe('[notificacionesApi.remove]', async () => {
      const qs = usuarioId ? `?usuarioId=${usuarioId}` : '';
      const res = await apiRequest<{ success: boolean }>(`/api/notificaciones/${notifId}${qs}`, {
        method: 'DELETE',
      });
      return Boolean(res?.success);
    }, false);
  },

  async reglas(): Promise<string[]> {
    return safe('[notificacionesApi.reglas]', async () => {
      const res = await apiRequest<{ eventos: string[] }>('/api/notificaciones/reglas');
      return res?.eventos ?? [];
    }, []);
  },
};
