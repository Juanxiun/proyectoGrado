import { API_BASE_URL } from '../constants/config';
import { storage } from '../utils/storage';
import type { ApiError } from '../types';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await storage.getToken();
  return token ? { Authorization: ('Bearer ' + token) } : {};
}

function isFormData(body: unknown): body is FormData {
  if (!body || typeof body !== 'object') return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  const candidate = body as FormData;
  return (
    typeof candidate.append === 'function' &&
    (Object.prototype.toString.call(body) === '[object FormData]' ||
      (body as { constructor?: { name?: string } }).constructor?.name === 'FormData')
  );
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (auth) {
    Object.assign(headers, await getAuthHeaders());
  }

  const isMultipart = isFormData(body);

  if (isMultipart) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else if (body) {
    headers['Content-Type'] = 'application/json';
  }

  let finalBody: BodyInit | undefined;
  if (isMultipart) {
    finalBody = body as FormData;
  } else if (body !== undefined && body !== null) {
    finalBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers,
    body: finalBody,
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const err = (await response.json()) as ApiError;
      message = err.error ?? message;
    } catch {
      /* respuesta no JSON */
    }
    throw new ApiClientError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
