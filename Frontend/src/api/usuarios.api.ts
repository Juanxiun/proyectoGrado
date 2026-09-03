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
    const newFoto = isLocalFileUri(fotoUri) ? fotoUri : undefined;
    const hasFiles = Boolean(newFoto) || (datos.documentos?.some((d) => isLocalFileUri(d.fileUri)) ?? false);
    if (hasFiles) return sendMultipart<UpdateUsuarioResponse>(`/api/usuarios/${id}`, 'PUT', datos, newFoto);
    return apiRequest<UpdateUsuarioResponse>(`/api/usuarios/${id}`, { method: 'PUT', body: datos });
  },

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/api/usuarios/${id}`, { method: 'DELETE' }),

  baja: (id: string) =>
    apiRequest<{ message: string; estado: number }>(`/api/usuarios/${id}/baja`, { method: 'PATCH' }),
};

function isLocalFileUri(uri?: string | null): uri is string {
  if (!uri) return false;
  return (
    uri.startsWith('blob:') ||
    uri.startsWith('file:') ||
    uri.startsWith('data:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library:')
  );
}

function getNameAndType(uri: string, fallback: string, defaultType: string): { name: string; type: string } {
  const name = uri.startsWith('data:') ? fallback : uri.split('/').pop()?.split('?')[0] || fallback;
  const ext = name.split('.').pop()?.toLowerCase();
  const type = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : defaultType;
  return { name, type };
}

/**
 * Convierte URIs locales a Blob/File reales para que fetch envíe el boundary multipart.
 * En React Native con file:// se usa el descriptor { uri, name, type } que el FormData nativo espera.
 */
async function buildFilePart(
  uri: string,
  name: string,
  type: string,
): Promise<Blob | { uri: string; name: string; type: string }> {
  const needsBlob = Platform.OS === 'web' || uri.startsWith('blob:') || uri.startsWith('data:');

  if (needsBlob) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mime = blob.type || type;
      if (typeof File !== 'undefined') {
        return new File([blob], name, { type: mime });
      }
      const fileBlob = blob as Blob & { name?: string; type?: string };
      fileBlob.name = name;
      fileBlob.type = mime;
      return fileBlob;
    } catch {
      // Fallback para data-uri en caso de que fetch falle
      if (uri.startsWith('data:')) {
        const parts = uri.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || type;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        if (typeof File !== 'undefined') {
          return new File([blob], name, { type: mime });
        }
        return blob;
      }
    }
  }

  return { uri, name, type };
}

async function sendMultipart<T = { message: string; id: string; fotoUrl: string | null }>(
  endpoint: string,
  method: 'POST' | 'PUT',
  payload: CreateUsuarioPayload | UpdateUsuarioPayload,
  fotoUri?: string,
): Promise<T> {
  const form = new FormData();

  const documentos = (payload.documentos ?? []).map(({ fileUri, fileName, ...doc }) => doc);
  form.append('datos', JSON.stringify({ ...payload, documentos }));

  const localFoto = isLocalFileUri(fotoUri) ? fotoUri : undefined;
  if (localFoto) {
    const { name, type } = getNameAndType(localFoto, 'foto.jpg', 'image/jpeg');
    const part = await buildFilePart(localFoto, name, type);
    // En Web/browser se debe pasar el tercer argumento (filename) para asegurar encabezado Content-Disposition
    if (Platform.OS === 'web') {
      form.append('foto', part as unknown as Blob, name);
    } else {
      form.append('foto', part as unknown as Blob);
    }
  }

  for (const [index, doc] of (payload.documentos ?? []).entries()) {
    if (isLocalFileUri(doc.fileUri)) {
      const { name, type } = getNameAndType(doc.fileUri, doc.fileName ?? 'documento.pdf', 'application/pdf');
      const part = await buildFilePart(doc.fileUri, name, type);
      if (Platform.OS === 'web') {
        form.append(`doc_file_${index}`, part as unknown as Blob, name);
        if (doc.tipoDoc) {
          form.append(`doc_file_${doc.tipoDoc}`, part as unknown as Blob, name);
        }
      } else {
        form.append(`doc_file_${index}`, part as unknown as Blob);
        if (doc.tipoDoc) {
          form.append(`doc_file_${doc.tipoDoc}`, part as unknown as Blob);
        }
      }
    }
  }

  return apiRequest<T>(endpoint, { method, body: form });
}
