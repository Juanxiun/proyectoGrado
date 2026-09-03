// Configuración de MinIO leída desde variables de entorno
export const minio = {
  MINIO_ENDPOINT: String(Deno.env.get("MINIO_ENDPOINT") ?? "http://localhost:9000"),
  MINIO_PUBLIC_URL: String(Deno.env.get("MINIO_PUBLIC_URL") ?? Deno.env.get("MINIO_ENDPOINT") ?? "http://localhost:9000"),
  MINIO_ACCESS_KEY: String(Deno.env.get("MINIO_ACCESS_KEY")),
  MINIO_SECRET_KEY: String(Deno.env.get("MINIO_SECRET_KEY")),
  MINIO_BUCKET: String(Deno.env.get("MINIO_BUCKET") ?? "usuarios"),
};
