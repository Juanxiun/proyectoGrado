// config -> jwt secret y expiracion
export const jwtConfig = {
  secret: String(Deno.env.get("JWT_SECRET") ?? "nosexd"),
  expiresIn: "7d",
  issuer: "service-control-academico",
};