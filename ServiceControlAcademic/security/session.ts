// auth -> validacion de sesion en redis
import { getRedis } from "../connects/Redis/redis.ts";

const SESION_PREFIX = "session:";

export async function isSessionValidAndActive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const redis = getRedis();
    if (!redis) return false;
    const key = `${SESION_PREFIX}${sessionId}`;
    const raw = await redis.get(key);
    if (!raw) return false;
    const session = JSON.parse(raw);
    return session.activo === true;
  } catch {
    return false;
  }
}