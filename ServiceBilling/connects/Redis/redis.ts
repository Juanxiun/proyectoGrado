// deno-lint-ignore-file no-explicit-any
import { Redis } from "ioredis";
import { host, port } from "../../config/redis.conf.ts";

let redisClient: any = null;
let isConnecting = false;

export function getRedis(): any {
  if (!redisClient) {
    try {
      redisClient = new (Redis as any)({
        host,
        port,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      redisClient.on("connect", () => {
        console.log(`[Redis] Conectado exitosamente a ${host}:${port}`);
      });

      redisClient.on("error", (err: Error) => {
        console.warn(`[Redis] Advertencia de conexión (${host}:${port}): ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error("[Redis] Error inicializando cliente Redis:", err);
    }
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis && redis.status === "wait") {
    await redis.connect().catch((err: Error) => {
      console.warn("[Redis] No se pudo conectar:", err.message);
    });
  }
}