// config -> conexion postgresql
export const pgConfig = {
  host: String(Deno.env.get("DB_HOST") ?? "host.docker.internal"),
  port: Number(Deno.env.get("DB_PORT") ?? 5432),
  user: String(Deno.env.get("DB_USER") ?? "ShalomAccess"),
  database: String(Deno.env.get("DB_NAME") ?? "ShalomDBGM"),
  password: String(Deno.env.get("DB_PASS") ?? "ShAloM4"),
  pool: Number(Deno.env.get("DB_POOL") ?? 10),
};