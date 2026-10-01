import { Context } from "@oak/oak";
import { HttpError } from "./errors.ts";

export function routeParam(ctx: Context, name: string): string | undefined {
  const params = (ctx as Context & { params?: Record<string, string> }).params;
  return params?.[name];
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
  console.error(`[Dashboard] ${fallback}`, err);
  respond(ctx, 500, {
    error: fallback,
    detail: err instanceof Error ? err.message : String(err),
    statusCode: 500,
  });
}
