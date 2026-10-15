// deno-lint-ignore-file no-explicit-any
import { Client } from "npm:minio";
import sharp from "sharp";
import { minio as cfg } from "../../config/minio.config.ts";
import { scanUpload, UploadSecurityError } from "../../utils/uploadSecurity.ts";

const endpointUrl = new URL(cfg.MINIO_ENDPOINT);
const useSSL = endpointUrl.protocol === "https:";
const port = endpointUrl.port
  ? parseInt(endpointUrl.port, 10)
  : useSSL ? 443 : 9000;

// config -> region us-east-1
const REGION = "us-east-1";

const client = new Client({
  endPoint: endpointUrl.hostname,
  port,
  useSSL,
  accessKey: cfg.MINIO_ACCESS_KEY.trim(),
  secretKey: cfg.MINIO_SECRET_KEY.trim(),
  region: REGION,
});

const BUCKET = cfg.MINIO_BUCKET;
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
      // cors -> configurar en consola minio
    })();
  }
  await bucketReady;
}

// metodo -> subir archivo bucket
export async function uploadFile(
  key: string,
  data: Uint8Array,
  contentType?: string,
): Promise<string> {
  validateDocument(key, data);
  await scanUpload(data);
  return putFile(key, data, contentType ?? inferDocumentMime(key));
}

async function putFile(
  key: string,
  data: Uint8Array,
  contentType: string,
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
  _contentType: string,
): Promise<string> {
  const baseKey = key.replace(/\.[^./\\]+$/, "");
  return storeWebpImage(`${baseKey}.webp`, data);
}

async function storeWebpImage(key: string, data: Uint8Array): Promise<string> {
  const maxImageBytes = 25 * 1024 * 1024;
  if (data.byteLength === 0 || data.byteLength > maxImageBytes) {
    throw new UploadSecurityError("La imagen debe tener un tamaño entre 1 byte y 25 MB", 400);
  }
  await scanUpload(data);
  let webp: Uint8Array;
  try {
    const image = sharp(data, { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format) {
      throw new Error("Formato de imagen no permitido");
    }
    webp = await image.rotate().webp({ quality: 82, effort: 4 }).toBuffer();
  } catch (error) {
    console.warn("[minio] Imagen inválida o no compatible:", error);
    throw new UploadSecurityError("La foto no es una imagen válida o el formato no es compatible", 400);
  }
  return putFile(key, webp, "image/webp");
}

function validateDocument(key: string, data: Uint8Array): void {
  if (data.byteLength === 0 || data.byteLength > 25 * 1024 * 1024) {
    throw new UploadSecurityError("El documento debe tener un tamaño entre 1 byte y 25 MB", 400);
  }
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf" && new TextDecoder().decode(data.subarray(0, 5)) === "%PDF-";
  const isOfficeZip = (ext === "docx" || ext === "xlsx") && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
  const isXls = ext === "xls" && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, i) => data[i] === byte);
  if (!isPdf && !isOfficeZip && !isXls) {
    throw new UploadSecurityError("Solo se permiten archivos PDF, DOCX, XLSX o XLS válidos", 400);
  }
}

function inferDocumentMime(key: string): string {
  switch (key.split(".").pop()?.toLowerCase()) {
    case "pdf": return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls": return "application/vnd.ms-excel";
    default: return "application/octet-stream";
  }
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
  // util -> clave directa sin url
  if (url && !url.startsWith("http://") && !url.startsWith("https://") && url.length > 0) {
    return url.split("?")[0];
  }
  return null;
}

// presign -> no cambiar host firmado
export async function getPresignedUrl(
  key: string,
  _expirySeconds?: number,
): Promise<string> {
  await ensureBucket();
  const publica = buildPublicUrl(key);
  return publica;
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
