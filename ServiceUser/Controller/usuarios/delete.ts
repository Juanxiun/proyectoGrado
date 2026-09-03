import { RouterContext } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import {
  deleteImage,
  getKeyFromUrl,
} from "../../connects/Storage/minio.ts";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

/**
 * DELETE /usuarios/:id
 *
 * Elimina el usuario de la base de datos (ON DELETE CASCADE borra todas
 * las tablas relacionadas) y elimina su foto de MinIO si existe.
 *
 * Orden: primero BD, luego MinIO. Si la BD falla no se toca MinIO.
 * Si la BD tiene éxito pero MinIO falla, se loguea el error sin revertir
 * (la imagen queda huérfana en MinIO pero el registro ya no existe).
 */
export async function deleteUsuario(
  ctx: RouterContext<"/usuarios/:id">,
): Promise<void> {
  try {
    const id = ctx.params.id;
    if (!/^\d+$/.test(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El id debe ser numérico" };
      return;
    }

    //Obtener foto_url antes de borrar
    const userRes = await query<{ foto_url: string | null; rol: string }>(
      `SELECT u.foto_url, r.rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1`,
      [id],
    );

    if (userRes.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Usuario con id=${id} no encontrado` };
      return;
    }
    const targetRole = userRes.rows[0].rol.trim().toLowerCase();
    if (ctx.state.auth?.role === "control" &&
      !["profesor", "maestro", "docente", "estudiante"].includes(targetRole)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Control solo puede gestionar profesores y estudiantes" };
      return;
    }

    const fotoUrl = userRes.rows[0].foto_url;

    //Eliminar de la BD (CASCADE borra cuenta, docs, dir, contactos, etc.)
    await query(`DELETE FROM usuarios WHERE id = $1`, [id]);

    //Eliminar imagen de MinIO
    if (fotoUrl) {
      const key = getKeyFromUrl(fotoUrl);
      if (key) {
        try {
          await deleteImage(key);
        } catch (minioErr) {
          // No revertir la BD; solo registrar el problema
          console.warn(
            `[deleteUsuario] No se pudo eliminar imagen de MinIO (key=${key}):`,
            minioErr,
          );
        }
      }
    }

    ctx.response.status = 200;
    broadcastUserEvent({ action: "deleted", userId: id });
    ctx.response.body = {
      message: `Usuario id=${id} eliminado correctamente`,
    };
  } catch (err) {
    console.error("[deleteUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
