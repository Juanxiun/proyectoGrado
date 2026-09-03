import "./env.config.ts";

export function getRedisConfig() {
  const rawUrl = Deno.env.get("REDIS_URL") ?? Deno.env.get("REDIS_HOST") ?? "127.0.0.1";
  const host = rawUrl === "redis_cache" ? "127.0.0.1" : rawUrl;
  const port = Number(Deno.env.get("REDIS_PORT") ?? 6379);
  const username = Deno.env.get("REDIS_USER") || undefined;
  const password = Deno.env.get("REDIS_PASSWORD") || undefined;

  return {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
  };
}

export const redisConfig = getRedisConfig();
