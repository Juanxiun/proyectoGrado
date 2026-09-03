// deno-lint-ignore-file no-explicit-any
import { Redis } from "ioredis";
import { redisConfig } from "../../config/redis.conf.ts";

let redisClient: any = null;
let isConnecting = false;

export function getRedis(): any {
  if (!redisClient) {
    try {
      redisClient = new (Redis as any)({
        host: redisConfig.host,
        port: redisConfig.port,
        username: redisConfig.username,
        password: redisConfig.password,
        maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
        retryStrategy: redisConfig.retryStrategy,
        lazyConnect: true,
      });

      redisClient.on("connect", () => {
        console.log(`[Redis] Conectado exitosamente a ${redisConfig.host}:${redisConfig.port}`);
      });

      redisClient.on("error", (err: Error) => {
        console.warn(`[Redis] Advertencia de conexión (${redisConfig.host}:${redisConfig.port}): ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error("[Redis] Error inicializando cliente Redis:", err);
    }
  }

  // Ensure connection if not connected
  if (redisClient && redisClient.status === "wait" && !isConnecting) {
    isConnecting = true;
    redisClient.connect().catch((err: Error) => {
      console.warn(`[Redis] Fallo al conectar inmediatamente a Redis: ${err?.message ?? err}`);
    }).finally(() => {
      isConnecting = false;
    });
  }

  return redisClient;
}

export default getRedis;
