import { getRedis } from "../../connects/Redis/redis.ts";

export async function emitNotification(eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const redis = getRedis();
    const canal = Deno.env.get("EVENTOS_CANAL") || "notificaciones:eventos";
    await redis.publish(
      canal,
      JSON.stringify({
        eventType,
        origen: "ServiceHomework",
        payload,
        emittedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn("[EvaluacionTrimestral] No se pudo publicar notificación:", err);
  }
}
