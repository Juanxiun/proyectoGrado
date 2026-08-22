import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { minio } from "../../config/minio.config.ts";

// Cliente S3 compatible con MinIO
const s3 = new S3Client({
  endpoint: minio.MINIO_ENDPOINT,
  region: "us-east-1", // MinIO acepta cualquier región
  credentials: {
    accessKeyId: minio.MINIO_ACCESS_KEY,
    secretAccessKey: minio.MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Requerido para MinIO (path-style en lugar de virtual-hosted)
});

/**
 * Sube un archivo WebP al bucket de MinIO.
 * @param key  Nombre del objeto en el bucket (ej: "estudiante_juan_1234567890.webp")
 * @param data Bytes del archivo WebP
 * @returns    URL pública del objeto subido
 */
export async function uploadImage(key: string, data: Uint8Array): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: minio.MINIO_BUCKET,
      Key: key,
      Body: data,
      ContentType: "image/webp",
    }),
  );
  return buildPublicUrl(key);
}

/**
 * Elimina un objeto del bucket de MinIO.
 * @param key Nombre del objeto en el bucket
 */
export async function deleteImage(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: minio.MINIO_BUCKET,
      Key: key,
    }),
  );
}

/**
 * Construye la URL pública de un objeto en MinIO.
 */
export function buildPublicUrl(key: string): string {
  return `${minio.MINIO_ENDPOINT}/${minio.MINIO_BUCKET}/${key}`;
}

/**
 * Extrae el key (nombre) del objeto a partir de su URL pública.
 * Devuelve null si la URL no pertenece al bucket configurado.
 */
export function getKeyFromUrl(url: string): string | null {
  const prefix = `${minio.MINIO_ENDPOINT}/${minio.MINIO_BUCKET}/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  return null;
}
