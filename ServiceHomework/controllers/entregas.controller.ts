import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  parsePagination,
  readJsonBody,
  respond,
  routeParam,
} from "../utils/http.ts";
import * as entregaService from "../services/entrega.service.ts";
import { uploadMaterialFile } from "../connects/Storage/minio.ts";
import { HttpError } from "../utils/errors.ts";
import type { CreateEncargoEntregaInput } from "../models/homework.ts";
import { AuthClaims } from "../security/auth.ts";

export async function listEntregas(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const claims = (ctx.state.auth as AuthClaims) ?? null;
    const result = await entregaService.listEntregas(
      parsePagination(params),
      {
        encargoId: params.get("encargoId") ?? undefined,
        estudianteId: params.get("estudianteId") ?? undefined,
        estadoEntrega: params.get("estadoEntrega") ?? undefined,
      },
      claims,
    );
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar entregas");
  }
}

export async function getEntrega(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const claims = (ctx.state.auth as AuthClaims) ?? null;
    respond(ctx, 200, await entregaService.getEntregaById(id, claims));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener entrega");
  }
}

import {
  buildEntregaObjectKey,
  resolveCursoInfoFromEncargo,
  sanitizeLevel,
} from "../utils/fileNaming.ts";

export async function createEntrega(ctx: Context): Promise<void> {
  try {
    const claims = (ctx.state.auth as AuthClaims) ?? null;
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // Manejo de subida por multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();
      const file = form.get("file");
      const encargoId = form.get("encargoId")?.toString();
      const comentario = form.get("comentario")?.toString() ?? null;
      const estudianteId = form.get("estudianteId")?.toString() ?? undefined;

      if (!encargoId) {
        throw new HttpError(400, "encargoId es requerido");
      }
      if (!(file instanceof File)) {
        throw new HttpError(400, "Se requiere adjuntar un archivo válido para la entrega");
      }

      const fileBuffer = new Uint8Array(await file.arrayBuffer());
      const subId = claims?.sub ?? "estudiante";
      const cursoInfo = await resolveCursoInfoFromEncargo(encargoId);
      const objectKey = buildEntregaObjectKey(cursoInfo, encargoId, subId, file.name);

      // Validación MinIO de 150MB y formatos PDF/Word/Excel
      const uploaded = await uploadMaterialFile(objectKey, fileBuffer, file.name, file.type);

      const created = await entregaService.createOrUpdateEntrega(
        {
          encargoId,
          estudianteId,
          comentario,
          archivoUrl: uploaded.url,
          nombreArchivo: file.name,
          tipoMime: uploaded.mime,
          tamanioBytes: uploaded.sizeBytes,
        },
        claims,
      );

      respond(ctx, 201, created);
      return;
    }

    // Creación mediante JSON estándar
    const body = await readJsonBody<CreateEncargoEntregaInput>(ctx);
    respond(ctx, 201, await entregaService.createOrUpdateEntrega(body, claims));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al enviar la tarea");
  }
}

export async function deleteEntrega(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"));
    const claims = (ctx.state.auth as AuthClaims) ?? null;
    await entregaService.deleteEntrega(id, claims);
    respond(ctx, 200, { message: `Entrega id=${id} eliminada` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar la entrega");
  }
}
