export const pg = {
  DB_HOST: String(Deno.env.get("DB_HOST")),
  DB_PORT: Number(Deno.env.get("DB_PORT")),
  DB_USER: String(Deno.env.get("DB_USER")),
  DB_NAME: String(Deno.env.get("DB_NAME")),
  DB_PASS: String(Deno.env.get("DB_PASS")),
  DB_SIZE: Number(Deno.env.get("DB_POOL")),
  DB_SSL: Boolean(Deno.env.get("DB_SSL") === "true"),
};
