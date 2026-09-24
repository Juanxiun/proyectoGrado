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
import { createAndDispatchNotification } from "../services/notification.service.ts";

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
  sanitizeLevel,
} from "../utils/fileNaming.ts";

export async function createMaterial(ctx: Context): Promise<void> {
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // Manejo de subida de archivo por Multipart Form-Data
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

      // Validación de 150MB y tipos PDF/Word/Excel en MinIO
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

      createAndDispatchNotification({
        tipo: "material",
        titulo: created.titulo,
        asignacionId: created.asignacionId,
        itemId: created.id,
      }).catch((e) => console.warn("[Material] Error enviando notificación:", e));

      respond(ctx, 201, created);
      return;
    }

    // Creación mediante JSON estándar
    const body = await readJsonBody<CreateMateriaMaterialInput>(ctx);
    const created = await materialService.createMaterial(body);
    createAndDispatchNotification({
      tipo: "material",
      titulo: created.titulo,
      asignacionId: created.asignacionId,
      itemId: created.id,
    }).catch((e) => console.warn("[Material] Error enviando notificación:", e));
    respond(ctx, 201, created);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al subir material");
  }
}

export async function updateMaterial(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // Soporte de reemplazo de archivo por Multipart Form-Data
    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();
      const file = form.get("file");
      const titulo = form.get("titulo")?.toString();
      const detalle = form.get("detalle")?.toString();
      const asignacionId = form.get("asignacionId")?.toString();
      const activoStr = form.get("activo")?.toString();

      const metadataUpdate: UpdateMateriaMaterialInput = {};
      if (titulo !== undefined) metadataUpdate.titulo = titulo;
      if (detalle !== undefined) metadataUpdate.detalle = detalle;
      if (activoStr !== undefined) metadataUpdate.activo = activoStr === "true";

      // Si se adjunta un nuevo archivo, reemplazamos el antiguo en MinIO
      if (file instanceof File) {
        const current = await materialService.getMaterialById(id);
        const fileBuffer = new Uint8Array(await file.arrayBuffer());
        const asigId = asignacionId ?? String(current.asignacionId);
        const cursoInfo = await resolveCursoInfoFromAsignacion(asigId);
        const objectKey = buildMaterialObjectKey(cursoInfo, asigId, file.name);

        // Sube nuevo archivo primero, luego borra el antiguo
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
      }

      if (Object.keys(metadataUpdate).length === 0) {
        throw new HttpError(400, "No se recibieron cambios para aplicar");
      }

      respond(ctx, 200, await materialService.updateMaterial(id, metadataUpdate));
      return;
    }

    // Actualización mediante JSON estándar (solo metadatos)
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
