import { API_BASE_URL } from "../constants/config";
import { storage } from "../utils/storage";
import type { ApiError } from "../types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  noCache?: boolean;
};

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const GET_CACHE_TTL_MS = 12_000;
const MAX_CACHE_ENTRIES = 120;
const getCache = new Map<string, CacheEntry>();
const inFlightGets = new Map<string, Promise<unknown>>();

const TECHNICAL_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/minio|bucket|s3/i, "No se pudo procesar el archivo en este momento. Intente nuevamente."],
  [/ollama|gemma|mistral|num_predict|embedding|rag|llm/i, "No se pudo generar el contenido en este momento. Intente nuevamente en unos segundos."],
  [/clamav|antivirus/i, "No se pudo verificar la seguridad del archivo. Intente nuevamente."],
  [/redis|postgres|econnrefused|host\.docker\.internal|etimedout|socket hang up/i, "El servicio no está disponible temporalmente. Intente nuevamente en unos momentos."],
];

function sanitizeUserErrorMessage(message: string, status: number): string {
  for (const [pattern, friendly] of TECHNICAL_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return friendly;
    }
  }
  if (status >= 500 && (!message || message.startsWith("Error "))) {
    return "Ocurrió un problema inesperado. Intente nuevamente.";
  }
  return message;
}

function shouldCacheEndpoint(endpoint: string): boolean {
  return !(
    endpoint.includes("/notificaciones") ||
    endpoint.includes("/status") ||
    endpoint.includes("/estado") ||
    endpoint.includes("/progreso") ||
    endpoint.includes("/sesiones")
  );
}

export function clearApiCache(): void {
  getCache.clear();
}

function setCacheEntry(key: string, data: unknown): void {
  if (getCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = getCache.keys().next().value;
    if (oldestKey !== undefined) getCache.delete(oldestKey);
  }
  getCache.set(key, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
}

async function getAuthToken(): Promise<string | null> {
  return storage.getToken();
}

function isFormData(body: unknown): body is FormData {
  if (!body || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  const candidate = body as FormData;
  return (
    typeof candidate.append === "function" &&
    (Object.prototype.toString.call(body) === "[object FormData]" ||
      (body as { constructor?: { name?: string } }).constructor?.name ===
        "FormData")
  );
}

async function executeFetch<T>(
  endpoint: string,
  rest: Omit<RequestInit, "body">,
  headers: Record<string, string>,
  finalBody: BodyInit | undefined,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers,
    body: finalBody,
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const err = (await response.json()) as ApiError & { detail?: unknown; message?: string };
      const detail = typeof err.detail === "string" ? err.detail : undefined;
      message = err.error ?? detail ?? err.message ?? message;
    } catch {
      /* respuesta no JSON */
    }
    throw new ApiClientError(sanitizeUserErrorMessage(message, response.status), response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text || !text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, noCache = false, headers: customHeaders, ...rest } = options;
  const method = (rest.method ?? "GET").toUpperCase();

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  let token: string | null = null;
  if (auth) {
    token = await getAuthToken();
    if (token) {
      headers.Authorization = "Bearer " + token;
    }
  }

  if (method !== "GET") {
    clearApiCache();
  }

  const canCache = method === "GET" && !noCache && shouldCacheEndpoint(endpoint);
  const cacheKey = `${token ?? "anon"}:${endpoint}`;

  if (canCache) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached) {
      getCache.delete(cacheKey);
    }
    const existing = inFlightGets.get(cacheKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const isMultipart = isFormData(body);

  if (isMultipart) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  } else if (body) {
    headers["Content-Type"] = "application/json";
  }

  let finalBody: BodyInit | undefined;
  if (isMultipart) {
    finalBody = body as FormData;
  } else if (body !== undefined && body !== null) {
    finalBody = typeof body === "string" ? body : JSON.stringify(body);
  }

  const requestPromise = executeFetch<T>(endpoint, rest, headers, finalBody);

  if (canCache) {
    inFlightGets.set(cacheKey, requestPromise);
    try {
      const result = await requestPromise;
      setCacheEntry(cacheKey, result);
      return result;
    } finally {
      inFlightGets.delete(cacheKey);
    }
  }

  return requestPromise;
}

export function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function safe<T>(_tag: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
