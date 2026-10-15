import { RouterContext } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import {
  deleteImage,
  getKeyFromUrl,
} from "../../connects/Storage/minio.ts";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

// ruta -> eliminar usuario y archivos
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
      !["profesor", "profesores", "maestro", "maestros", "docente", "estudiante", "estudiantes", "alumno", "alumnos", "apoderado", "tutor", "control", "administrativo", "gerencia", "secretaria", "secretario", "editor"].includes(targetRole)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Control puede gestionar docentes, estudiantes y personal de control" };
      return;
    }

    const fotoUrl = userRes.rows[0].foto_url;

    await sTransaction(async (tx) => {
      const estRes = await tx.queryObject<{ id: bigint }>(
        `SELECT id FROM estudiantes WHERE usuario_id = $1`,
        [id],
      );
      if (estRes.rows.length > 0) {
        const estId = estRes.rows[0].id;
        await tx.queryObject(`DELETE FROM inscripciones WHERE estudiante_id = $1`, [estId]);
        await tx.queryObject(`DELETE FROM estudiante_apoderado WHERE estudiante_id = $1`, [estId]);
        await tx.queryObject(`DELETE FROM estudiantes WHERE id = $1`, [estId]);
      }

      const apodRes = await tx.queryObject<{ id: bigint }>(
        `SELECT id FROM apoderados WHERE usuario_id = $1`,
        [id],
      );
      if (apodRes.rows.length > 0) {
        const apodId = apodRes.rows[0].id;
        await tx.queryObject(`DELETE FROM estudiante_apoderado WHERE apoderado_id = $1`, [apodId]);
        await tx.queryObject(`DELETE FROM apoderados WHERE id = $1`, [apodId]);
      }

      const maeRes = await tx.queryObject<{ id: bigint }>(
        `SELECT id FROM maestros WHERE usuario_id = $1`,
        [id],
      );
      if (maeRes.rows.length > 0) {
        const maeId = maeRes.rows[0].id;
        await tx.queryObject(`DELETE FROM asignaciones_docentes WHERE maestro_id = $1`, [maeId]);
        await tx.queryObject(`DELETE FROM curso_asesor WHERE maestro_id = $1`, [maeId]);
        await tx.queryObject(`DELETE FROM maestros WHERE id = $1`, [maeId]);
      }

      await tx.queryObject(`DELETE FROM usuarios WHERE id = $1`, [id]);
    });

    if (fotoUrl) {
      const key = getKeyFromUrl(fotoUrl);
      if (key) {
        try {
          await deleteImage(key);
        } catch (minioErr) {
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
