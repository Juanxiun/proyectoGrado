// deno-lint-ignore-file no-explicit-any
import { Client } from "minio";
import { Buffer } from "node:buffer";
import { minioConfig as cfg } from "../../config/minio.config.ts";
import { HttpError } from "../../utils/errors.ts";

const endpointUrl = new URL(cfg.MINIO_ENDPOINT);
const useSSL = endpointUrl.protocol === "https:";
const port = endpointUrl.port
  ? parseInt(endpointUrl.port, 10)
  : useSSL ? 443 : 9000;

export const minioClient = new Client({
  endPoint: endpointUrl.hostname,
  port,
  useSSL,
  accessKey: cfg.MINIO_ACCESS_KEY.trim(),
  secretKey: cfg.MINIO_SECRET_KEY.trim(),
});

const BUCKET = cfg.MINIO_BUCKET;
const PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 días
let bucketReady: Promise<void> | null = null;

function publicBase(): string {
  return (cfg.MINIO_PUBLIC_URL || cfg.MINIO_ENDPOINT).replace(/\/$/, "");
}

export async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const exists = await minioClient.bucketExists(BUCKET);
      if (!exists) {
        await minioClient.makeBucket(BUCKET);
      }
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      };
      try {
        await minioClient.setBucketPolicy(BUCKET, JSON.stringify(policy));
      } catch (e) {
        console.warn("[minio] No se pudo aplicar política pública de lectura:", e);
      }
    })();
  }
  await bucketReady;
}

export function validateMaterialFile(fileName: string, sizeBytes: number): void {
  if (sizeBytes > cfg.MAX_FILE_SIZE_BYTES) {
    throw new HttpError(400, `El archivo supera el tamaño máximo permitido de 150 MB (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB)`);
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!cfg.ALLOWED_EXTENSIONS.includes(ext)) {
    throw new HttpError(
      400,
      `Formato no permitido (.${ext}). Solo se admiten archivos PDF, Word (.docx, .doc) y Excel (.xlsx, .xls)`,
    );
  }
}

export function inferContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
}

/**
 * Sube un archivo validado a MinIO.
 */
export async function uploadMaterialFile(
  key: string,
  data: Uint8Array,
  fileName: string,
  contentType?: string,
): Promise<{ url: string; key: string; sizeBytes: number; mime: string }> {
  validateMaterialFile(fileName, data.byteLength);
  await ensureBucket();

  const buf = Buffer.from(data);
  const mime = contentType && contentType !== "application/octet-stream"
    ? contentType
    : inferContentType(fileName);

  await minioClient.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": mime,
    "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
  });

  const url = buildPublicUrl(key);
  return { url, key, sizeBytes: data.byteLength, mime };
}

export async function deleteMaterialFile(keyOrUrl: string): Promise<void> {
  const key = getKeyFromUrl(keyOrUrl) ?? keyOrUrl;
  try {
    await minioClient.removeObject(BUCKET, key);
  } catch (err) {
    console.warn(`[minio] No se pudo eliminar el archivo ${key}:`, err);
  }
}

export function buildPublicUrl(key: string): string {
  return `${publicBase()}/${BUCKET}/${key}`;
}

export function getKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/${BUCKET}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    }
  } catch {
    /* URL relativa */
  }
  const prefixes = [
    `${publicBase()}/${BUCKET}/`,
    `${cfg.MINIO_ENDPOINT.replace(/\/$/, "")}/${BUCKET}/`,
  ];
  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length).split("?")[0];
    }
  }
  return null;
}

export async function getPresignedUrl(
  key: string,
  expirySeconds = PRESIGN_EXPIRY_SECONDS,
): Promise<string> {
  await ensureBucket();
  try {
    return await minioClient.presignedGetObject(BUCKET, key, expirySeconds, {
      "response-content-disposition": "inline",
    });
  } catch (_err) {
    return await minioClient.presignedGetObject(BUCKET, key, expirySeconds);
  }
}

export async function resolveFileUrl(
  storedUrl: string | null | undefined,
): Promise<string | null> {
  if (!storedUrl) return null;
  const key = getKeyFromUrl(storedUrl);
  if (!key) return storedUrl;
  try {
    return await getPresignedUrl(key);
  } catch (e) {
    console.warn("[minio] No se pudo firmar URL, se usa pública:", e);
    return buildPublicUrl(key);
  }
}
