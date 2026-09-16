import { getRedis } from "../connects/Redis/redis.ts";

export async function isSessionValidAndActive(sessionId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    const raw = await redis.get(`session:${sessionId}`);
    if (!raw) return false;
    const session = JSON.parse(raw) as { activo?: boolean };
    return session.activo === true;
  } catch (err) {
    console.error("[session] No se pudo validar la sesión:", err);
    return false;
  }
}
