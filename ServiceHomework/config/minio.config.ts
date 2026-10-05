// config -> conexion minio
export const minioConfig = {
  MINIO_ENDPOINT: String(Deno.env.get("MINIO_ENDPOINT") ?? "http://localhost:9000"),
  MINIO_PUBLIC_URL: String(
    Deno.env.get("MINIO_PUBLIC_URL") ?? Deno.env.get("MINIO_ENDPOINT") ?? "http://localhost:9000",
  ),
  MINIO_ACCESS_KEY: String(Deno.env.get("MINIO_ACCESS_KEY") ?? "admin"),
  MINIO_SECRET_KEY: String(Deno.env.get("MINIO_SECRET_KEY") ?? "adminpassword"),
  MINIO_BUCKET: String(Deno.env.get("MINIO_BUCKET") ?? "shalom"),
  // config -> limites archivos
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024, // limite -> 25 megas clamav
  ALLOWED_EXTENSIONS: ["pdf", "docx", "xlsx", "xls"],
  ALLOWED_MIME_TYPES: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ],
};
