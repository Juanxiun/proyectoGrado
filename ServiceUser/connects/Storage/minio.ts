// deno-lint-ignore-file no-explicit-any
import { Client } from "npm:minio";
import { minio as cfg } from "../../config/minio.config.ts";

// Parsear la URL del endpoint para extraer host, puerto y protocolo
const endpointUrl = new URL(cfg.MINIO_ENDPOINT);
const useSSL = endpointUrl.protocol === "https:";
const port = endpointUrl.port
  ? parseInt(endpointUrl.port, 10)
  : useSSL ? 443 : 9000;

/** Cliente oficial MinIO (S3-compatible) */
const client = new Client({
  endPoint: endpointUrl.hostname,
  port,
  useSSL,
  accessKey: cfg.MINIO_ACCESS_KEY.trim(),
  secretKey: cfg.MINIO_SECRET_KEY.trim(),
});

const BUCKET = cfg.MINIO_BUCKET;

/**
 * Sube un archivo al bucket de MinIO.
 * @param key         Nombre del objeto  (ej: "juan_perez_est_perfil.jpg")
 * @param data        Bytes del archivo  (Uint8Array)
 * @param contentType Tipo MIME          (ej: "image/jpeg", "application/pdf")
 * @returns           URL pública del objeto subido
 */
export async function uploadFile(
  key: string,
  data: Uint8Array,
  contentType = "application/octet-stream",
): Promise<string> {
  const buf = Buffer.from(data);
  await client.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": contentType,
  });
  return buildPublicUrl(key);
}

/**
 * Sube una imagen PNG/JPG al bucket de MinIO.
 * @param key         Nombre del objeto
 * @param data        Bytes de la imagen
 * @param contentType MIME de la imagen  ("image/png" | "image/jpeg")
 * @returns           URL pública
 */
export function uploadImage(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  return uploadFile(key, data, contentType);
}

/**
 * Elimina un objeto del bucket de MinIO.
 * @param key Nombre del objeto en el bucket
 */
export async function deleteFile(key: string): Promise<void> {
  await client.removeObject(BUCKET, key);
}

/** Alias de deleteFile para compatibilidad con código existente. */
export const deleteImage = deleteFile;

/**
 * Construye la URL pública de un objeto en MinIO.
 */
export function buildPublicUrl(key: string): string {
  return `${cfg.MINIO_ENDPOINT}/${BUCKET}/${key}`;
}

/**
 * Extrae el key (nombre de objeto) a partir de su URL pública.
 * Devuelve null si la URL no pertenece al bucket configurado.
 */
export function getKeyFromUrl(url: string): string | null {
  const prefix = `${cfg.MINIO_ENDPOINT}/${BUCKET}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}

