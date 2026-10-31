// utils -> helpers http
import { Context } from "@oak/oak";
import { HttpError } from "./errors.ts";

export { HttpError };
export { mapDbError } from "./errors.ts";

export function parseNumericId(value: string | null | undefined): string {
  if (!value) throw new HttpError(400, "ID requerido");
  if (!/^\d+$/.test(value)) throw new HttpError(400, "ID debe ser numérico");
  return value;
}

export function parsePagination(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20)));
  return { page, limit, offset: (page - 1) * limit };
}

export async function readJsonBody<T>(ctx: Context): Promise<T> {
  const body = await ctx.request.body.json();
  return body as T;
}

export function routeParam(ctx: Context, name: string): string | null {
  // deno-lint-ignore no-explicit-any
  return (ctx as any).params?.[name] ?? null;
}

export function respond(ctx: Context, status: number, body: unknown): void {
  ctx.response.status = status;
  ctx.response.body = body as Record<string, unknown> | string | number | boolean | null | undefined;
}

export function handleControllerError(ctx: Context, err: unknown, defaultMsg: string): void {
  if (err instanceof HttpError) {
    ctx.response.status = err.status;
    ctx.response.body = { error: err.message };
    return;
  }
  console.error("[ControllerError]", err);
  ctx.response.status = 500;
  ctx.response.body = { error: defaultMsg };
}
