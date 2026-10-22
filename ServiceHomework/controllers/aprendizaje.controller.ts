import { Context } from "@oak/oak";
import { HttpError } from "../utils/errors.ts";
import { parseNumericId, respond, routeParam } from "../utils/http.ts";
import type { AuthClaims } from "../security/auth.ts";
import { readStoredFile } from "../connects/Storage/minio.ts";
import { getMaterialById } from "../services/material.service.ts";

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
async function llamarServicioLlm(path: string, method = "GET", body?: unknown, timeoutMs = 600_000): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${urlServicioLlm()}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-webhook-secret": secretoLlm() },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
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
  let formato = body.formato;
  if (formato === "CONEXIONES" || formato === "RESUMEN_PERSONALIZADO") formato = "ESQUEMA_GEMMA";
  if (formato !== "ESQUEMA_GEMMA" && formato !== "CARTAS_EXPLICATIVAS" && formato !== "auto") formato = "ESQUEMA_GEMMA";
  return responder(ctx, llamarServicioLlm(`/contents/${encodeURIComponent(contentId)}/summaries`, "POST", { formato }));
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
  try {
    const contenido = await llamarServicioLlm(`/documents/${encodeURIComponent(routeParam(ctx, "id") ?? "")}/learning`, "GET", undefined, 8_000);
    if (contenido.status !== 200) {
      respond(ctx, contenido.status, contenido.data);
      return;
    }
    const contentId = String((contenido.data as Record<string, unknown>).content_id);
    const cantidad = Number(ctx.request.url.searchParams.get("cantidad") ?? "6");
    const studentId = claims(ctx).sub;
    const resultado = await llamarServicioLlm(`/students/${encodeURIComponent(studentId)}/contents/${encodeURIComponent(contentId)}/quizzes`, "POST", {
      student_id: studentId,
      content_id: contentId,
      activity_count: cantidad === 5 ? 5 : 6,
    }, 15_000);
    respond(ctx, resultado.status, resultado.data);
  } catch (error) {
    const tiempoAgotado = error instanceof DOMException && error.name === "TimeoutError";
    console.error("[aprendizaje] No se pudo preparar el reto:", error);
    respond(ctx, tiempoAgotado ? 504 : 503, {
      error: tiempoAgotado ? "La actividad tardó demasiado; inténtalo nuevamente." : "No se pudo preparar la actividad. Comprueba la conexión e inténtalo de nuevo.",
    });
  }
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

// aprendizaje -> perfil integral mistral
export async function evaluarPerfilAprendizaje(ctx: Context): Promise<void> {
  const body = await ctx.request.body.json().catch(() => ({}));
  return responder(ctx, llamarServicioLlm(
    `/students/${encodeURIComponent(claims(ctx).sub)}/learning-overview`,
    "POST",
    { evidence: body.evidence ?? {} },
    75_000,
  ));
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

// pdf -> enviar el archivo al servicio LLM para vista previa
async function llamarVistaPreviaPdf(path: string, bytes: Uint8Array): Promise<Response> {
  return await fetch(`${urlServicioLlm()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/pdf", "x-webhook-secret": secretoLlm() },
    body: bytes as unknown as BodyInit,
    signal: AbortSignal.timeout(120_000),
  });
}

// pdf -> material PDF del estudiante con sus bytes
async function materialPdf(ctx: Context): Promise<{ id: string; bytes: Uint8Array }> {
  const id = parseNumericId(routeParam(ctx, "id") ?? "");
  const material = await getMaterialById(id);
  const esPdf = (material.tipoMime ?? "").includes("pdf") || /\.pdf$/i.test(material.nombreArchivo ?? "");
  if (!esPdf) throw new HttpError(415, "El material no es un PDF");
  return { id, bytes: await readStoredFile(material.archivoUrl) };
}

// pdf -> convertir bytes a base64 para enviarlos al cliente
function aBase64(bytes: Uint8Array): string {
  let binario = "";
  const trozo = 0x8000;
  for (let indice = 0; indice < bytes.length; indice += trozo) {
    binario += String.fromCharCode(...bytes.subarray(indice, indice + trozo));
  }
  return btoa(binario);
}

// pdf -> informacion de paginas para el lector integrado
export async function infoPaginasPdf(ctx: Context): Promise<void> {
  try {
    const { bytes } = await materialPdf(ctx);
    const respuesta = await llamarVistaPreviaPdf("/preview/pdf/info", bytes);
    const datos = await respuesta.json().catch(() => ({ error: "Respuesta inválida del servicio LLM" }));
    respond(ctx, respuesta.status, datos);
  } catch (err) {
    const estado = err instanceof HttpError ? err.status : 503;
    respond(ctx, estado, { error: err instanceof Error ? err.message : "No se pudo leer el PDF" });
  }
}

// pdf -> pagina renderizada como imagen para lectura en linea
export async function paginaPdf(ctx: Context): Promise<void> {
  try {
    const { bytes } = await materialPdf(ctx);
    const numero = Math.max(1, Number(routeParam(ctx, "numero") ?? "1") || 1);
    const respuesta = await llamarVistaPreviaPdf(`/preview/pdf/pagina/${numero}`, bytes);
    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => ({ error: "No se pudo generar la página" }));
      respond(ctx, respuesta.status, detalle);
      return;
    }
    const imagen = new Uint8Array(await respuesta.arrayBuffer());
    respond(ctx, 200, {
      pagina: Number(respuesta.headers.get("x-page-number") ?? numero),
      total: Number(respuesta.headers.get("x-total-pages") ?? 0),
      ancho: Number(respuesta.headers.get("x-page-width") ?? 0),
      alto: Number(respuesta.headers.get("x-page-height") ?? 0),
      imagen: `data:image/jpeg;base64,${aBase64(imagen)}`,
    });
  } catch (err) {
    const estado = err instanceof HttpError ? err.status : 503;
    respond(ctx, estado, { error: err instanceof Error ? err.message : "No se pudo generar la página" });
  }
}
