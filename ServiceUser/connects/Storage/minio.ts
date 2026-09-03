// deno-lint-ignore-file no-explicit-any
import { Client } from "npm:minio";
import { minio as cfg } from "../../config/minio.config.ts";

const endpointUrl = new URL(cfg.MINIO_ENDPOINT);
const useSSL = endpointUrl.protocol === "https:";
const port = endpointUrl.port
  ? parseInt(endpointUrl.port, 10)
  : useSSL ? 443 : 9000;

const client = new Client({
  endPoint: endpointUrl.hostname,
  port,
  useSSL,
  accessKey: cfg.MINIO_ACCESS_KEY.trim(),
  secretKey: cfg.MINIO_SECRET_KEY.trim(),
});

const BUCKET = cfg.MINIO_BUCKET;
const PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
let bucketReady: Promise<void> | null = null;

function publicBase(): string {
  return (cfg.MINIO_PUBLIC_URL || cfg.MINIO_ENDPOINT).replace(/\/$/, "");
}

async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const exists = await client.bucketExists(BUCKET);
      if (!exists) {
        await client.makeBucket(BUCKET);
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
        await client.setBucketPolicy(BUCKET, JSON.stringify(policy));
      } catch (e) {
        console.warn("[minio] No se pudo aplicar política pública de lectura:", e);
      }
    })();
  }
  await bucketReady;
}

/**
 * Sube un archivo al bucket de MinIO con Content-Type explícito.
 */
export async function uploadFile(
  key: string,
  data: Uint8Array,
  contentType = "application/octet-stream",
): Promise<string> {
  await ensureBucket();
  const buf = Buffer.from(data);
  const mime = contentType && contentType !== "application/octet-stream"
    ? contentType
    : inferContentType(key);
  await client.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": mime,
    "Content-Disposition": "inline",
  });
  return buildPublicUrl(key);
}

export function uploadImage(
  key: string,
  data: Uint8Array,
  contentType: string,
): Promise<string> {
  return uploadFile(key, data, contentType);
}

export async function deleteFile(key: string): Promise<void> {
  await client.removeObject(BUCKET, key);
}

export const deleteImage = deleteFile;

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
    /* URL relativa u otro formato */
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

/** URL pre-firmada para el navegador / React Native. */
export async function getPresignedUrl(
  key: string,
  expirySeconds = PRESIGN_EXPIRY_SECONDS,
): Promise<string> {
  await ensureBucket();
  return client.presignedGetObject(BUCKET, key, expirySeconds);
}

export async function resolveMediaUrl(
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

export async function resolveMediaIn<T>(obj: T): Promise<T> {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => resolveMediaIn(item))) as Promise<T>;
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    const resolved = await Promise.all(
      entries.map(async ([k, v]) => {
        if ((k === "fotoUrl" || k === "docUrl" || k === "foto_url" || k === "doc_url") && typeof v === "string") {
          return [k, await resolveMediaUrl(v)] as const;
        }
        if (v && typeof v === "object") {
          return [k, await resolveMediaIn(v)] as const;
        }
        return [k, v] as const;
      }),
    );
    return Object.fromEntries(resolved) as T;
  }
  return obj;
}

function inferContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "application/octet-stream";
}
