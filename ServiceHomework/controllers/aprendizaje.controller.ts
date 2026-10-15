import { Context } from "@oak/oak";
import { respond, routeParam } from "../utils/http.ts";
import type { AuthClaims } from "../security/auth.ts";

function claims(ctx: Context): AuthClaims {
  return ctx.state.auth as AuthClaims;
}

// llm -> secreto interno compartido
function secretoLlm(): string {
  return Deno.env.get("LLM_WEBHOOK_SECRET") || "shalom-llm-dev";
}

// llm -> url del servicio
function urlServicioLlm(): string {
  return String(Deno.env.get("LLM_SERVICE_URL") ?? "http://127.0.0.1:8890").replace(/\/$/, "");
}

// llm -> extraer mensaje error
function mensajeLlm(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const cuerpo = data as Record<string, unknown>;
  const detalle = cuerpo.error ?? cuerpo.detail ?? cuerpo.message;
  if (typeof detalle === "string" && detalle.trim()) return detalle;
  return fallback;
}

// llm -> reenviar al servicio
async function llamarServicioLlm(path: string, method = "GET", body?: unknown): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${urlServicioLlm()}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-webhook-secret": secretoLlm() },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });
  const data = await response.json().catch(() => ({ error: "Respuesta LLM inválida" }));
  if (response.status >= 400 && data && typeof data === "object" && !("error" in (data as object))) {
    return { status: response.status, data: { ...(data as object), error: mensajeLlm(data, "El contenido de aprendizaje no está disponible") } };
  }
  return { status: response.status, data };
}

async function responder(ctx: Context, operation: Promise<{ status: number; data: unknown }>): Promise<void> {
  try {
    const result = await operation;
    respond(ctx, result.status, result.data);
  } catch (error) {
    console.error("[aprendizaje] Error al consultar ServiceLLMs:", error);
    ctx.response.status = 503;
    ctx.response.body = { error: "El contenido de aprendizaje no está disponible" };
  }
}

export function getContenidoAprendizaje(ctx: Context): Promise<void> {
  return responder(ctx, llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`));
}

export async function crearResumen(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`);
  if (contenido.status !== 200) {
    respond(ctx, contenido.status, contenido.data);
    return;
  }
  const contentId = String((contenido.data as Record<string, unknown>).content_id);
  return responder(ctx, llamarServicioLlm(`/contents/${encodeURIComponent(contentId)}/summaries`, "POST", { formato: body.formato ?? "RESUMEN_PERSONALIZADO" }));
}

export async function explicarSeccion(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`);
  if (contenido.status !== 200) {
    respond(ctx, contenido.status, contenido.data);
    return;
  }
  const contentId = String((contenido.data as Record<string, unknown>).content_id);
  return responder(ctx, llamarServicioLlm(`/students/${encodeURIComponent(claims(ctx).sub)}/contents/${encodeURIComponent(contentId)}/explain-section`, "POST", body));
}

export async function crearReto(ctx: Context): Promise<void> {
  const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`);
  if (contenido.status !== 200) {
    respond(ctx, contenido.status, contenido.data);
    return;
  }
  const contentId = String((contenido.data as Record<string, unknown>).content_id);
  const cantidad = Number(ctx.request.url.searchParams.get("cantidad") ?? "6");
  const studentId = claims(ctx).sub;
  return responder(ctx, llamarServicioLlm(`/students/${encodeURIComponent(studentId)}/contents/${encodeURIComponent(contentId)}/quizzes`, "POST", {
    student_id: studentId,
    content_id: contentId,
    activity_count: cantidad === 5 ? 5 : 6,
  }));
}

export async function completarReto(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`);
  if (contenido.status !== 200) {
    respond(ctx, contenido.status, contenido.data);
    return;
  }
  return responder(ctx, llamarServicioLlm("/webhooks/quiz-completed", "POST", {
    student_id: claims(ctx).sub,
    content_id: String((contenido.data as Record<string, unknown>).content_id),
    attempt_id: routeParam(ctx, "quizId") ?? "",
    answers: body.answers,
    elapsed_ms: Number.isFinite(Number(body.elapsed_ms)) ? Math.max(0, Math.min(3_600_000, Number(body.elapsed_ms))) : 0,
  }));
}

// quiz -> validar pareja elegida
export async function validarEmparejamiento(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`);
  if (contenido.status !== 200) {
    respond(ctx, contenido.status, contenido.data);
    return;
  }
  const contentId = String((contenido.data as Record<string, unknown>).content_id);
  const studentId = claims(ctx).sub;
  const quizId = encodeURIComponent(routeParam(ctx, "quizId") ?? "");
  return responder(ctx, llamarServicioLlm(`/students/${encodeURIComponent(studentId)}/contents/${encodeURIComponent(contentId)}/quizzes/${quizId}/check-match`, "POST", {
    activity_id: String(body.activity_id ?? ""),
    left: String(body.left ?? ""),
    right: String(body.right ?? ""),
  }));
}
