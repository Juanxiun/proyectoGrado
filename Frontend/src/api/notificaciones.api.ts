import { apiRequest } from './client';

export interface NotificationItem {
  id: string;
  tipo: 'material' | 'actividad';
  titulo: string;
  materiaNombre: string;
  profesorNombre: string;
  cursoParalelo: string;
  publicoTexto: string;
  fechaLimite?: string | null;
  asignacionId: string;
  cursoPeriodoId: string;
  itemId?: string;
  fechaCreacion: string;
  textoPlano: string;
  leido?: boolean;
}

export const notificacionesApi = {
  async list(usuarioId?: string | number, unreadOnly = false): Promise<NotificationItem[]> {
    try {
      const params = new URLSearchParams();
      if (usuarioId) params.append('usuarioId', String(usuarioId));
      if (unreadOnly) params.append('unreadOnly', 'true');
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
};
