import { Context } from "@oak/oak";
import { HttpError } from "./errors.ts";

export function routeParam(ctx: Context, name: string): string | undefined {
  const params = (ctx as Context & { params?: Record<string, string> }).params;
  return params?.[name];
}

export function parsePagination(searchParams: URLSearchParams): { limit: number } {
  const limitValue = Number(searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitValue) ? Math.min(200, Math.max(1, Math.floor(limitValue))) : 50;
  return { limit };
}

export async function readJsonBody<T = Record<string, unknown>>(ctx: Context): Promise<T> {
  try {
    return await ctx.request.body.json() as T;
  } catch {
    throw new HttpError(400, "Cuerpo JSON inválido");
  }
}

export function respond(ctx: Context, status: number, body: unknown): void {
  ctx.response.status = status;
  ctx.response.body = body as Record<string, unknown> | unknown[];
}

export function handleControllerError(ctx: Context, err: unknown, fallback: string): void {
  if (err instanceof HttpError) {
    respond(ctx, err.status, { error: err.message, statusCode: err.status });
    return;
  }
  const status = (err as any)?.status || (err as any)?.statusCode;
  const message = (err as any)?.message;
  if (typeof status === "number" && status >= 400 && status < 600) {
    respond(ctx, status, { error: message || fallback, statusCode: status });
    return;
  }
  const pgCode = (err as any)?.code;
  if (pgCode === "23505") {
    respond(ctx, 409, { error: "Conflicto: Ya existe un registro con esos datos clave", detail: message, statusCode: 409 });
    return;
  }
  if (pgCode === "23503") {
    respond(ctx, 400, { error: "Referencia inválida o no encontrada", detail: message, statusCode: 400 });
    return;
  }
  if (pgCode === "23502") {
    respond(ctx, 400, { error: "Faltan campos obligatorios para la operación", detail: message, statusCode: 400 });
    return;
  }
  console.error(fallback, err);
  respond(ctx, 500, { error: fallback, detail: message, statusCode: 500 });
}
