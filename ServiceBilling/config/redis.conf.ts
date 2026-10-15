const rawUrl = Deno.env.get("REDIS_URL") ?? "127.0.0.1";
const host = rawUrl === "redis_cache" ? "127.0.0.1" : rawUrl;
const port = Number(Deno.env.get("REDIS_PORT") ?? 6379);

export { host, port };