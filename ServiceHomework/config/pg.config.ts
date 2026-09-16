export const pgConfig = {
  host: Deno.env.get("DB_HOST") ?? "localhost",
  port: Number(Deno.env.get("DB_PORT") ?? 5432),
  user: Deno.env.get("DB_USER") ?? "ShalomAccess",
  database: Deno.env.get("DB_NAME") ?? "ShalomDB",
  password: Deno.env.get("DB_PASS") ?? "ShAloM4",
  tls: {
    enabled: (Deno.env.get("DB_SSL") ?? "false").toLowerCase() === "true",
  },
  poolSize: Number(Deno.env.get("DB_POOL") ?? 20),
};
