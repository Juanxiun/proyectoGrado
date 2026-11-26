// deno-lint-ignore-file no-explicit-any
import { getRagRedis } from "../../connects/Redis/redis.ts";
import { HttpError } from "../../utils/errors.ts";

export function llmUrl(): string {
  return String(Deno.env.get("LLM_SERVICE_URL") ?? "http://127.0.0.1:8890").replace(/\/$/, "");
}

export function llmSecret(): string {
  return Deno.env.get("LLM_WEBHOOK_SECRET") || "shalom-llm-dev";
}

export async function callLlmJson(path: string, body: unknown, timeoutMs = 600_000): Promise<any> {
  const res = await fetch(`${llmUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": llmSecret(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.detail === "string"
      ? data.detail
      : typeof data?.error === "string"
      ? data.error
      : "No se pudo completar la operación solicitada.";
    throw new HttpError(res.status >= 400 && res.status < 600 ? res.status : 502, msg);
  }
  return data;
}

export async function fetchExamJobStatus(examId: string): Promise<Record<string, string> | null> {
  // 1. Leer progreso directamente desde Redis RAG (shalom:rag:job:exam-{id})
  try {
    const ragRedis = getRagRedis();
    if (ragRedis) {
      const hash = await ragRedis.hgetall(`shalom:rag:job:exam-${examId}`);
      if (hash && typeof hash === "object" && Object.keys(hash).length > 0) {
        return hash as Record<string, string>;
      }
    }
  } catch {
    /* fallback a HTTP */
  }

  // 2. Fallback HTTP hacia ServiceAcademicLLMs
  try {
    const res = await fetch(`${llmUrl()}/trimester-exams/jobs/exam-${encodeURIComponent(examId)}`, {
      method: "GET",
      headers: {
        "x-webhook-secret": llmSecret(),
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export async function fetchExamFromRag(examId: string, knownKey?: string): Promise<any | null> {
  // 1. Leer directamente desde Redis RAG (shalom:rag:examn:...)
  try {
    const ragRedis = getRagRedis();
    if (ragRedis) {
      const candidateKeys: string[] = [];
      if (knownKey) candidateKeys.push(knownKey);
      const indexedKey = await ragRedis.get(`shalom:rag:examn:by_id:${examId}`);
      if (indexedKey && !candidateKeys.includes(indexedKey)) {
        candidateKeys.push(indexedKey);
      }

      for (const k of candidateKeys) {
        const raw = await ragRedis.get(k);
        if (raw) {
          try {
            return JSON.parse(raw);
          } catch {
            /* continuar */
          }
        }
      }

      // Buscar por patrón shalom:rag:examn:*:*:*:*:{examId}
      let cursor = "0";
      const pattern = `shalom:rag:examn:*:*:*:*:${examId}`;
      for (let i = 0; i < 10; i++) {
        const [nextCursor, keys] = await ragRedis.scan(cursor, "MATCH", pattern, "COUNT", 200);
        if (Array.isArray(keys) && keys.length > 0) {
          const raw = await ragRedis.get(keys[0]);
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              /* continuar */
            }
          }
        }
        cursor = String(nextCursor ?? "0");
        if (cursor === "0") break;
      }
    }
  } catch {
    /* fallback a HTTP */
  }

  // 2. Fallback HTTP hacia ServiceAcademicLLMs
  try {
    const res = await fetch(`${llmUrl()}/trimester-exams/rag/by-id/${encodeURIComponent(examId)}`, {
      method: "GET",
      headers: {
        "x-webhook-secret": llmSecret(),
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export function parseJsonArray(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
