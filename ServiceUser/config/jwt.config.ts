// Configuración de JWT leída desde variables de entorno
export const jwtConfig = {
  secret: String(Deno.env.get("JWT_SECRET") ?? "cambiar-en-produccion"),
  expiresIn: "24h",
};
