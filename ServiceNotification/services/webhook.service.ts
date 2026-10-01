function isAllowedCallbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return [
      Deno.env.get("GATEWAY_PUBLIC_URL"),
      Deno.env.get("GATEWAY_CALLBACK_ORIGIN"),
      Deno.env.get("PUBLIC_URL"),
      "http://localhost:5141",
      "http://127.0.0.1:5141",
      "http://gateway:5141",
      "http://restapi:5141",
    ].filter((origin): origin is string => Boolean(origin))
      .some((allowed) => new URL(allowed).origin === url.origin);
  } catch {
    return false;
  }
}

export async function sendWebhookCallback(
  callbackUrl: string,
  eventId: string,
  status: number,
  data: unknown,
  error: string | null,
): Promise<void> {
  try {
    if (!isAllowedCallbackUrl(callbackUrl)) {
      console.error(`[Webhook] Callback no permitido: ${callbackUrl}`);
      return;
    }
    await fetch(callbackUrl, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status, data, error }),
    });
  } catch (cbErr) {
    console.error(`[Webhook] No se pudo enviar callback a ${callbackUrl}:`, cbErr);
  }
}
