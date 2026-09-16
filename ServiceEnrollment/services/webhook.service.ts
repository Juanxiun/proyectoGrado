// services/webhook.service.ts
export async function sendWebhookCallback(
  callbackUrl: string,
  eventId: string,
  status: number,
  data: unknown,
  error: string | null,
): Promise<void> {
  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status, data, error }),
    });
  } catch (cbErr) {
    console.error(`[Webhook] No se pudo enviar callback a ${callbackUrl}:`, cbErr);
  }
}
