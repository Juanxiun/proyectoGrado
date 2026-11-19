// deno-lint-ignore-file no-explicit-any
import { Redis } from "ioredis";
import { redisConfig } from "../../config/redis.conf.ts";

let redisClient: any = null;
let isConnecting = false;

let ragRedisClient: any = null;
let isRagConnecting = false;

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
        console.log(`[Redis] Conectado a ${redisConfig.host}:${redisConfig.port}`);
      });

      redisClient.on("error", (err: Error) => {
        console.warn(`[Redis] ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error("[Redis] Error inicializando cliente:", err);
    }
  }

  if (redisClient && redisClient.status === "wait" && !isConnecting) {
    isConnecting = true;
    redisClient.connect().catch((err: Error) => {
      console.warn(`[Redis] Fallo al conectar: ${err?.message ?? err}`);
    }).finally(() => {
      isConnecting = false;
    });
  }

  return redisClient;
}

export function getRagRedis(): any {
  if (!ragRedisClient) {
    try {
      const host = Deno.env.get("REDIS_RAG_HOST") || redisConfig.host || "host.docker.internal";
      const port = Number(Deno.env.get("REDIS_RAG_PORT") ?? 6380);
      const username = Deno.env.get("REDIS_RAG_USERNAME") || "default";
      const password = Deno.env.get("REDIS_RAG_PASSWORD") ?? "AdminRagPass123";

      ragRedisClient = new (Redis as any)({
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        maxRetriesPerRequest: 2,
        connectTimeout: 2500,
        retryStrategy(times: number) {
          return Math.min(times * 200, 3000);
        },
        lazyConnect: true,
      });

      ragRedisClient.on("connect", () => {
        console.log(`[Redis RAG] Conectado a ${host}:${port}`);
      });

      ragRedisClient.on("error", (err: Error) => {
        console.warn(`[Redis RAG] ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error("[Redis RAG] Error inicializando cliente:", err);
    }
  }

  if (ragRedisClient && ragRedisClient.status === "wait" && !isRagConnecting) {
    isRagConnecting = true;
    ragRedisClient.connect().catch((err: Error) => {
      console.warn(`[Redis RAG] Fallo al conectar: ${err?.message ?? err}`);
    }).finally(() => {
      isRagConnecting = false;
    });
  }

  return ragRedisClient;
}

export default getRedis;
