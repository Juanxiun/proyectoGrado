export const jwtConfig = {
  secret: Deno.env.get("JWT_SECRET") ?? "cambiar-en-produccion",
  expiresIn: "8h",
};