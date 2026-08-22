import { RouterContext } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import {
  deleteImage,
  getKeyFromUrl,
} from "../../connects/Storage/minio.ts";

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

    // ── Obtener foto_url antes de borrar ─────────────────────────────────────
    const userRes = await query<{ foto_url: string | null }>(
      `SELECT foto_url FROM usuarios WHERE id = $1`,
      [id],
    );

    if (userRes.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Usuario con id=${id} no encontrado` };
      return;
    }

    const fotoUrl = userRes.rows[0].foto_url;

    // ── Eliminar de la BD (CASCADE borra cuenta, docs, dir, contactos, etc.) ─
    await query(`DELETE FROM usuarios WHERE id = $1`, [id]);

    // ── Eliminar imagen de MinIO ──────────────────────────────────────────────
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
    ctx.response.body = {
      message: `Usuario id=${id} eliminado correctamente`,
    };
  } catch (err) {
    console.error("[deleteUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
