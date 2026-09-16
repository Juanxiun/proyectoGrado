export const jwtConfig = {
  secret: Deno.env.get("JWT_SECRET") ?? "nosexd",
};
