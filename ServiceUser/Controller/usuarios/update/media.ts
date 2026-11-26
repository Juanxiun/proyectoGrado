import { RouterContext } from "@oak/oak";
import { deleteFile, getKeyFromUrl, uploadFile, uploadImage } from "../../../connects/Storage/minio.ts";
import { buildDocKey, buildPhotoKey } from "../../../utils/fileNaming.ts";
import { formFieldAsString, readFilePart, readMultipartForm } from "../../../utils/multipart.ts";

export interface ParsedUpdateRequest {
  // deno-lint-ignore no-explicit-any
  datos: Record<string, any>;
  fotoBytes: Uint8Array | null;
  fotoExt: "webp" | null;
  documentFiles: Array<{ index: number; bytes: Uint8Array; name: string }>;
}

const ALLOWED_DOC_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "xls"]);

// usuarios -> parseo de payload json o multipart con validacion de adjuntos
export async function parseUsuarioUpdateRequest(
  ctx: RouterContext<"/usuarios/:id">,
): Promise<{ ok: true; value: ParsedUpdateRequest } | { ok: false; status: number; error: string }> {
  const contentType = ctx.request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    const datos = await ctx.request.body.json();
    return { ok: true, value: { datos, fotoBytes: null, fotoExt: null, documentFiles: [] } };
  }

  try {
    const form = await readMultipartForm(ctx);
    const datosRaw = await formFieldAsString(form.get("datos"));
    if (!datosRaw) {
      return { ok: false, status: 400, error: "El campo 'datos' (JSON string) es obligatorio en multipart" };
    }

    const datos = JSON.parse(datosRaw);
    const fotoPart = await readFilePart(form.get("foto"));
    const documentFiles: Array<{ index: number; bytes: Uint8Array; name: string }> = [];

    if (Array.isArray(datos.documentos)) {
      for (let i = 0; i < datos.documentos.length; i++) {
        const doc = datos.documentos[i];
        const docPart = await readFilePart(form.get(`doc_file_${i}`) || form.get(`doc_file_${doc.tipoDoc}`));
        if (!docPart) continue;
        const extension = docPart.name.split(".").pop()?.toLowerCase() ?? "";
        if (!ALLOWED_DOC_EXTENSIONS.has(extension)) {
          return { ok: false, status: 400, error: `El documento ${i + 1} debe ser PDF, DOCX, XLSX o XLS` };
        }
        documentFiles.push({ index: i, bytes: docPart.bytes, name: docPart.name });
      }
    }

    return {
      ok: true,
      value: {
        datos,
        fotoBytes: fotoPart?.bytes ?? null,
        fotoExt: fotoPart ? "webp" : null,
        documentFiles,
      },
    };
  } catch (e) {
    console.error("[updateUsuario] Error parseando multipart:", e);
    return {
      ok: false,
      status: 400,
      error: `Error procesando el formulario multipart: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// usuarios -> subida paralela de foto y documentos a MinIO
export async function uploadUsuarioMedia(params: {
  currentFotoUrl: string | null;
  nombre: string;
  apellidoPaterno: string;
  rolNombre: string;
  fotoBytes: Uint8Array | null;
  fotoExt: "webp" | null;
  // deno-lint-ignore no-explicit-any
  documentos: any[] | undefined;
  documentFiles: Array<{ index: number; bytes: Uint8Array; name: string }>;
  nivel?: string;
  grado?: string;
}): Promise<{ newFotoUrl: string | null; updatedDocumentos: unknown }> {
  let newFotoUrl = params.currentFotoUrl;

  const fotoTask = (async () => {
    if (params.fotoBytes === null || params.fotoExt === null) return;
    const newKey = buildPhotoKey(params.nombre, params.apellidoPaterno, params.rolNombre, params.fotoExt);
    const oldKey = params.currentFotoUrl ? getKeyFromUrl(params.currentFotoUrl) : null;
    if (oldKey && oldKey !== newKey) {
      await deleteFile(oldKey).catch((e) => console.warn("[updateUsuario] No se pudo borrar foto anterior:", e));
    }
    newFotoUrl = await uploadImage(newKey, params.fotoBytes, "image/webp");
  })();

  const updatedDocumentos = Array.isArray(params.documentos) ? [...params.documentos] : params.documentos;
  const docsTask = Array.isArray(updatedDocumentos) && params.documentFiles.length > 0
    ? Promise.all(
      params.documentFiles.map(async (file) => {
        const doc = updatedDocumentos[file.index];
        if (!doc) return;
        const docKey = buildDocKey(
          params.nombre,
          params.apellidoPaterno,
          params.rolNombre,
          doc.tipoDoc,
          params.nivel,
          params.grado,
          file.name.split(".").pop()?.toLowerCase() ?? "pdf",
        );
        doc.docUrl = await uploadFile(docKey, file.bytes);
      }),
    )
    : Promise.resolve();

  await Promise.all([fotoTask, docsTask]);
  return { newFotoUrl, updatedDocumentos };
}
