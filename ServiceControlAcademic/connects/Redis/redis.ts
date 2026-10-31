// redis -> conexion ioredis
// deno-lint-ignore-file no-explicit-any
import { Redis } from "ioredis";
import { redisConfig } from "../../config/redis.conf.ts";

let redisClient: any = null;

export function getRedis(): any {
  if (!redisClient) {
    try {
      redisClient = new (Redis as any)({
        host: redisConfig.host,
        port: redisConfig.port,
        username: redisConfig.username,
        password: redisConfig.password,
        db: redisConfig.db,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      redisClient.on("connect", () => {
        console.log("[Redis] Conectado");
      });

      redisClient.on("error", (err: Error) => {
        console.warn("[Redis] Error:", err.message);
      });
    } catch (err: any) {
      console.error("[Redis] Error inicializando:", err);
    }
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export { redisConfig as REDIS_CONFIG, redisConfig as EVENTOS_CANAL };