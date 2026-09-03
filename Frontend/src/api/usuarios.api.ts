import { Platform } from 'react-native';
import { apiRequest, buildQuery } from './client';
import type {
  UpdateUsuarioPayload,
  UpdateUsuarioResponse,
  CreateUsuarioPayload,
  Usuario,
  UsuariosListResponse,
  UsuariosQueryParams,
} from '../types';

export const usuariosApi = {
  list: (params: UsuariosQueryParams = {}) =>
    apiRequest<UsuariosListResponse>(`/api/usuarios${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Usuario>(`/api/usuarios/${id}`),

  create: (payload: CreateUsuarioPayload) =>
    apiRequest<{ message: string; id: string; fotoUrl: string | null }>('/api/usuarios', { method: 'POST', body: payload }),

  createWithFiles: (payload: CreateUsuarioPayload, fotoUri?: string) =>
    sendMultipart('/api/usuarios', 'POST', payload, fotoUri),

  update: (id: string, payload: UpdateUsuarioPayload) =>
    apiRequest<UpdateUsuarioResponse>(`/api/usuarios/${id}`, { method: 'PUT', body: payload }),

  updateWithPhoto: (id: string, datos: UpdateUsuarioPayload, fotoUri: string) =>
    sendMultipart<UpdateUsuarioResponse>(`/api/usuarios/${id}`, 'PUT', datos, fotoUri),

  updateWithFiles: (id: string, datos: UpdateUsuarioPayload, fotoUri?: string) => {
    const hasFiles = fotoUri || (datos.documentos?.some((d) => d.fileUri) ?? false);
    if (hasFiles) return sendMultipart<UpdateUsuarioResponse>(`/api/usuarios/${id}`, 'PUT', datos, fotoUri);
    return apiRequest<UpdateUsuarioResponse>(`/api/usuarios/${id}`, { method: 'PUT', body: datos });
  },

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/api/usuarios/${id}`, { method: 'DELETE' }),
};

// Helpers

function getNameAndType(uri: string, fallback: string, defaultType: string): { name: string; type: string } {
  const name = uri.startsWith('data:') ? fallback : uri.split('/').pop() || fallback;
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : defaultType;
  return { name, type };
}

/**
 * Construye la parte de archivo para FormData compatible con native y web.
 *
 * - Native: devuelve { uri, name, type }  — React Native fetch lo convierte
 *           en binario correctamente al construir el multipart body.
 * - Web:    el fetch del navegador NO entiende { uri, name, type } y lo
 *           convertiria en "[object Object]". Aqui hacemos fetch(uri) para
 *           obtener el Blob real y creamos un File object.
 */
async function buildFilePart(
  uri: string,
  name: string,
  type: string,
): Promise<Blob | { uri: string; name: string; type: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type || type });
  }
  return { uri, name, type } as unknown as Blob;
}

/**
 * Envia una peticion multipart/form-data.
 * FormData contiene: "datos" (JSON) + "foto" (imagen) + "doc_file_N" (PDFs).
 */
async function sendMultipart<T = { message: string; id: string; fotoUrl: string | null }>(
  endpoint: string,
  method: 'POST' | 'PUT',
  payload: CreateUsuarioPayload | UpdateUsuarioPayload,
  fotoUri?: string,
): Promise<T> {
  const form = new FormData();

  const documentos = (payload.documentos ?? []).map(({ fileUri, fileName, ...doc }) => doc);
  form.append('datos', JSON.stringify({ ...payload, documentos }));

  if (fotoUri) {
    const { name, type } = getNameAndType(fotoUri, 'foto.jpg', 'image/jpeg');
    const part = await buildFilePart(fotoUri, name, type);
    form.append('foto', part as Blob);
  }

  for (const [index, doc] of (payload.documentos ?? []).entries()) {
    if (doc.fileUri) {
      const { name, type } = getNameAndType(doc.fileUri, doc.fileName ?? 'documento.pdf', 'application/pdf');
      const part = await buildFilePart(doc.fileUri, name, type);
      form.append(`doc_file_${index}`, part as Blob);
    }
  }

  return apiRequest<T>(endpoint, { method, body: form });
}
