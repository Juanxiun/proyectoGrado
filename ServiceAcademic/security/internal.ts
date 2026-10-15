import { Context, Next } from "@oak/oak";

// seguridad -> token interno servicios
const esperado = () => Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push";

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function requireInternalToken() {
  return async (ctx: Context, next: Next): Promise<void> => {
    const presentado = ctx.request.headers.get("X-Internal-Token") ?? "";
    const token = esperado();

    if (!presentado || !iguales(presentado, token)) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token interno inválido" };
      return;
    }

    await next();
  };
}
