import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as materialService from "../services/material.service.ts";
import { deleteMaterialFile, uploadMaterialFile } from "../connects/Storage/minio.ts";
import { HttpError } from "../utils/errors.ts";
import type { CreateMateriaMaterialInput, UpdateMateriaMaterialInput } from "../models/homework.ts";
import { publicarEventoAsync } from "../utils/events.ts";

export async function listMateriales(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const result = await materialService.listMateriales(parsePagination(params), {
      asignacionId: params.get("asignacionId") ?? undefined,
      activo: params.get("activo") !== null ? params.get("activo") === "true" : undefined,
      buscar: params.get("buscar") ?? undefined,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar materiales");
  }
}

export async function getMaterial(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    respond(ctx, 200, await materialService.getMaterialById(id));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener material");
  }
}

import {
  buildMaterialObjectKey,
  resolveCursoInfoFromAsignacion,
} from "../utils/fileNaming.ts";

function notificarMaterialAlServicioLlm(input: {
  materialId: string;
  asignacionId: string;
  titulo: string;
  detalle?: string | null;
  fileName: string;
  mime: string;
  fileBytes: Uint8Array;
  objectKey: string;
  cursoInfo: Awaited<ReturnType<typeof resolveCursoInfoFromAsignacion>>;
}): void {
  void (async () => {
    try {
      const digest = await crypto.subtle.digest("SHA-256", input.fileBytes.slice().buffer as ArrayBuffer);
      const fingerprint = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
      const minioBase = String(Deno.env.get("MINIO_ENDPOINT") ?? "http://host.docker.internal:9000").replace(/\/$/, "");
      const encodedKey = input.objectKey.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`${String(Deno.env.get("LLM_SERVICE_URL") ?? "http://service-llms:8890").replace(/\/$/, "")}/webhooks/content-created`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": Deno.env.get("LLM_WEBHOOK_SECRET") ?? "",
        },
        body: JSON.stringify({
          event: "content.created",
          content_id: `${input.materialId}-${fingerprint}`,
          document_id: input.materialId,
          document_url: `${minioBase}/materiales/${encodedKey}`,
          document_name: input.fileName,
          mime_type: input.mime,
          title: input.titulo,
          description: input.detalle,
          subject: input.cursoInfo.materia,
          subject_id: input.cursoInfo.materiaId,
          assignment_id: input.asignacionId,
          grade: input.cursoInfo.grado,
          parallel: input.cursoInfo.paralelo,
          source: "ServiceHomework",
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) console.warn(`[LLM] Webhook rechazado para material_id=${input.materialId}: HTTP ${response.status}`);
    } catch (error) {
      console.warn(`[LLM] No se pudo encolar material_id=${input.materialId}:`, error);
    }
  })();
}

export async function createMaterial(ctx: Context): Promise<void> {
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // material -> subir archivo multipart
    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();
      const file = form.get("file");
      const asignacionId = form.get("asignacionId")?.toString();
      const titulo = form.get("titulo")?.toString();
      const detalle = form.get("detalle")?.toString() ?? null;

      if (!asignacionId || !titulo) {
        throw new HttpError(400, "asignacionId y titulo son requeridos");
      }
      if (!(file instanceof File)) {
        throw new HttpError(400, "Se requiere adjuntar un archivo válido");
      }

      const fileBuffer = new Uint8Array(await file.arrayBuffer());
      const cursoInfo = await resolveCursoInfoFromAsignacion(asignacionId);
      const objectKey = buildMaterialObjectKey(cursoInfo, asignacionId, file.name);

      // minio -> validar formato archivo
      const uploaded = await uploadMaterialFile(objectKey, fileBuffer, file.name, file.type);

      const created = await materialService.createMaterial({
        asignacionId,
        titulo,
        detalle,
        archivoUrl: uploaded.url,
        nombreArchivo: file.name,
        tipoMime: uploaded.mime,
        tamanioBytes: uploaded.sizeBytes,
        activo: true,
      });

      publicarEventoAsync("materiales.create", {
        titulo: created.titulo,
        asignacionId: created.asignacionId,
        itemId: created.id,
      });

      notificarMaterialAlServicioLlm({
        materialId: String(created.id), asignacionId: String(created.asignacionId),
        titulo: created.titulo, detalle: created.detalle, fileName: file.name,
        mime: uploaded.mime, fileBytes: fileBuffer, objectKey, cursoInfo,
      });

      respond(ctx, 201, created);
      return;
    }

    // material -> crear por json
    const body = await readJsonBody<CreateMateriaMaterialInput>(ctx);
    const created = await materialService.createMaterial(body);
    publicarEventoAsync("materiales.create", {
      titulo: created.titulo,
      asignacionId: created.asignacionId,
      itemId: created.id,
    });
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al subir material");
  }
}

export async function updateMaterial(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // material -> reemplazar archivo multipart
    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();
      const file = form.get("file");
      const titulo = form.get("titulo")?.toString();
      const detalle = form.get("detalle")?.toString();
      const asignacionId = form.get("asignacionId")?.toString();
      const activoStr = form.get("activo")?.toString();
      let llmFile: Parameters<typeof notificarMaterialAlServicioLlm>[0] | null = null;

      const metadataUpdate: UpdateMateriaMaterialInput = {};
      if (titulo !== undefined) metadataUpdate.titulo = titulo;
      if (detalle !== undefined) metadataUpdate.detalle = detalle;
      if (activoStr !== undefined) metadataUpdate.activo = activoStr === "true";

      // minio -> reemplazar archivo adjunto
      if (file instanceof File) {
        const current = await materialService.getMaterialById(id);
        const fileBuffer = new Uint8Array(await file.arrayBuffer());
        const asigId = asignacionId ?? String(current.asignacionId);
        const cursoInfo = await resolveCursoInfoFromAsignacion(asigId);
        const objectKey = buildMaterialObjectKey(cursoInfo, asigId, file.name);

        // minio -> subir antes borrar
        const uploaded = await uploadMaterialFile(objectKey, fileBuffer, file.name, file.type);
        if (current.archivoUrl) {
          deleteMaterialFile(current.archivoUrl).catch((e) =>
            console.warn("[Material] Error eliminando archivo anterior de MinIO:", e)
          );
        }

        metadataUpdate.archivoUrl = uploaded.url;
        metadataUpdate.nombreArchivo = file.name;
        metadataUpdate.tipoMime = uploaded.mime;
        metadataUpdate.tamanioBytes = uploaded.sizeBytes;
        llmFile = {
          materialId: String(id), asignacionId: asigId, titulo: titulo ?? current.titulo,
          detalle: detalle ?? current.detalle, fileName: file.name, mime: uploaded.mime,
          fileBytes: fileBuffer, objectKey, cursoInfo,
        };
      }

      if (Object.keys(metadataUpdate).length === 0) {
        throw new HttpError(400, "No se recibieron cambios para aplicar");
      }

      const updated = await materialService.updateMaterial(id, metadataUpdate);
      if (llmFile) notificarMaterialAlServicioLlm({ ...llmFile, titulo: updated.titulo, detalle: updated.detalle });
      respond(ctx, 200, updated);
      return;
    }

    // material -> actualizar solo metadatos
    const body = await readJsonBody<UpdateMateriaMaterialInput>(ctx);
    respond(ctx, 200, await materialService.updateMaterial(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar material");
  }
}

export async function deleteMaterial(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    await materialService.deleteMaterial(id);
    respond(ctx, 200, { message: `Material id=${id} eliminado exitosamente` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar material");
  }
}
