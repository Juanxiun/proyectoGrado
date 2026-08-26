import { apiRequest, buildQuery } from './client';
import type {
  UpdateUsuarioPayload,
  UpdateUsuarioResponse,
  Usuario,
  UsuariosListResponse,
  UsuariosQueryParams,
} from '../types';

export const usuariosApi = {
  list: (params: UsuariosQueryParams = {}) =>
    apiRequest<UsuariosListResponse>(`/api/usuarios${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Usuario>(`/api/usuarios/${id}`),

  update: (id: string, payload: UpdateUsuarioPayload) =>
    apiRequest<UpdateUsuarioResponse>(`/api/usuarios/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  updateWithPhoto: (id: string, datos: UpdateUsuarioPayload, fotoUri: string) => {
    const form = new FormData();
    form.append('datos', JSON.stringify(datos));

    const filename = fotoUri.split('/').pop() ?? 'foto.jpg';
    form.append('foto', {
      uri: fotoUri,
      name: filename,
      type: 'image/jpeg',
    } as unknown as Blob);

    return apiRequest<UpdateUsuarioResponse>(`/api/usuarios/${id}`, {
      method: 'PUT',
      body: form,
    });
  },

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/api/usuarios/${id}`, { method: 'DELETE' }),
};
