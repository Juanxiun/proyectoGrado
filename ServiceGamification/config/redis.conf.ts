// config -> conexion redis
export const redisConfig = {
  host: String(Deno.env.get("REDIS_URL") ?? "host.docker.internal"),
  port: Number(Deno.env.get("REDIS_PORT") ?? 6379),
  username: String(Deno.env.get("REDIS_USER") ?? "cache_user"),
  password: String(Deno.env.get("REDIS_PASSWORD") ?? "UserCachePass123"),
  db: Number(Deno.env.get("REDIS_DB") ?? 0),
  eventosCanal: String(Deno.env.get("EVENTOS_CANAL") ?? "notificaciones:eventos"),
};