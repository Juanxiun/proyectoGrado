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
import { uploadMaterialFile } from "../connects/Storage/minio.ts";
import { HttpError } from "../utils/errors.ts";
import type { CreateMateriaMaterialInput, UpdateMateriaMaterialInput } from "../models/homework.ts";

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
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectKey = `materiales/${asignacionId}/${Date.now()}_${safeName}`;

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

      respond(ctx, 201, created);
      return;
    }

    // Creación mediante JSON estándar
    const body = await readJsonBody<CreateMateriaMaterialInput>(ctx);
    respond(ctx, 201, await materialService.createMaterial(body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al subir material");
  }
}

export async function updateMaterial(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
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
