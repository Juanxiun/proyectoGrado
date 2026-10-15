// config -> conexion postgresql
export const pgConfig = {
  hostname: String(Deno.env.get("DB_HOST") ?? "host.docker.internal"),
  port: Number(Deno.env.get("DB_PORT") ?? 5432),
  user: String(Deno.env.get("DB_USER") ?? "ShalomAccess"),
  database: String(Deno.env.get("DB_NAME") ?? "ShalomDB"),
  password: String(Deno.env.get("DB_PASS") ?? "ShAloM4"),
  tls: {
    enabled: Deno.env.get("DB_SSL") === "true",
  },
  pool: Number(Deno.env.get("DB_POOL") ?? 10),
};