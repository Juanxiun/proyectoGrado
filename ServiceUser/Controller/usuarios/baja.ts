import { RouterContext } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

/**
 * PATCH /usuarios/:id/baja
 * Baja lógica: estado = 0 (Inactivo). No elimina filas ni objetos en MinIO.
 */
export async function bajaUsuario(
  ctx: RouterContext<"/usuarios/:id/baja">,
): Promise<void> {
  try {
    const id = ctx.params.id;
    if (!/^\d+$/.test(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El id debe ser numerico" };
      return;
    }

    const userRes = await query<{ rol: string; estado: number }>(
      `SELECT r.rol, u.estado
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
    if (
      ctx.state.auth?.role === "control" &&
      !["profesor", "maestro", "docente", "estudiante"].includes(targetRole)
    ) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Control solo puede gestionar profesores y estudiantes",
      };
      return;
    }

    await query(
      `UPDATE usuarios SET estado = 0, fecha_actualizacion = NOW() WHERE id = $1`,
      [id],
    );

    ctx.response.status = 200;
    broadcastUserEvent({ action: "updated", userId: id });
    ctx.response.body = {
      message: `Usuario id=${id} dado de baja (estado inactivo)`,
      estado: 0,
    };
  } catch (err) {
    console.error("[bajaUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
