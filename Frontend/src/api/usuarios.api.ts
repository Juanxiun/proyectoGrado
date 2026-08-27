import { wsClient } from './websocket.client';
import type {
  UpdateUsuarioPayload,
  UpdateUsuarioResponse,
  Usuario,
  UsuariosListResponse,
  UsuariosQueryParams,
} from '../types';

export const usuariosApi = {
  list: (params: UsuariosQueryParams = {}) =>
    wsClient.sendWsRequest<UsuariosListResponse>('usuarios.list', params),

  getById: (id: string) =>
    wsClient.sendWsRequest<Usuario>('usuarios.get', { id }),

  update: (id: string, payload: UpdateUsuarioPayload) =>
    wsClient.sendWsRequest<UpdateUsuarioResponse>('usuarios.update', { id, ...payload }),

  updateWithPhoto: (id: string, datos: UpdateUsuarioPayload, fotoUri: string) =>
    wsClient.sendWsRequest<UpdateUsuarioResponse>('usuarios.update', {
      id,
      ...datos,
      fotoUri,
    }),

  delete: (id: string) =>
    wsClient.sendWsRequest<{ message: string }>('usuarios.delete', { id }),
};
