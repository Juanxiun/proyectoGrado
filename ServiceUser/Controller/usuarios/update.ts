import { RouterContext } from "@oak/oak";
import bcrypt from "bcryptjs";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { resolveMediaUrl } from "../../connects/Storage/minio.ts";
import { validateUsernamePolicy } from "../auth/changePassword.ts";
import { broadcastUserEvent } from "../../services/websocket.service.ts";
import { parseUsuarioUpdateRequest, uploadUsuarioMedia } from "./update/media.ts";
import {
  type DynamicUsuarioUpdate,
  syncSelfOnboardingStatus,
  syncUsuarioRoleProfiles,
} from "./update/profiles.ts";

const ROLES_GESTIONABLES_CONTROL = new Set([
  "profesor", "maestro", "docente", "estudiante", "padre", "padres",
  "apoderado", "tutor", "control", "administrativo", "gerencia",
  "secretaria", "secretario", "editor",
]);

const ROLES_ONBOARDING = new Set(["estudiante", "alumno", "padre", "padres", "apoderado", "tutor"]);

// usuarios -> actualizacion de usuario, cuenta, perfiles y adjuntos
export async function updateUsuario(ctx: RouterContext<"/usuarios/:id">): Promise<void> {
  try {
    const id = ctx.params.id;
    if (!/^\d+$/.test(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El id debe ser numerico" };
      return;
    }

    const parsed = await parseUsuarioUpdateRequest(ctx);
    if (!parsed.ok) {
      ctx.response.status = parsed.status;
      ctx.response.body = { error: parsed.error };
      return;
    }
    const { datos, fotoBytes, fotoExt, documentFiles } = parsed.value;

    const currentRes = await query<{
      foto_url: string | null;
      username: string;
      rol: string;
      nombre: string;
      apellido_paterno: string;
    }>(
      `SELECT u.foto_url, uc.username, r.rol, u.nombre, u.apellido_paterno
       FROM usuarios u
       LEFT JOIN usuario_cuenta uc ON uc.usuario_id = u.id
       JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1`,
      [id],
    );
    if (currentRes.rows.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Usuario con id=${id} no encontrado` };
      return;
    }

    const current = currentRes.rows[0];
    const dynamicData = datos as DynamicUsuarioUpdate;
    const viewerRole = ctx.state.auth?.role;
    const isSelf = String(ctx.state.auth?.sub) === String(id);
    const targetRole = current.rol.trim().toLowerCase();
    const canManage = viewerRole === "director" ||
      (viewerRole === "control" && ROLES_GESTIONABLES_CONTROL.has(targetRole));

    if (!isSelf && !canManage) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: viewerRole === "control"
          ? "Control puede gestionar docentes, estudiantes y personal de control"
          : "No tiene permisos para actualizar este usuario",
      };
      return;
    }

    const {
      nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado,
      cuenta, documentos, direccion, contactos, maestro, rolId,
    } = datos;
    const normalizedEstado = estado === 1 || estado === "activo"
      ? "activo"
      : estado === 0 || estado === "inactivo"
      ? "inactivo"
      : estado;

    if (isSelf && viewerRole === "estudiante") {
      const hasForbidden = [nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado, maestro, rolId]
        .some((v) => v !== undefined) ||
        Boolean(cuenta && (cuenta.username !== undefined || cuenta.email !== undefined)) ||
        documentos !== undefined;
      if (hasForbidden) {
        ctx.response.status = 403;
        ctx.response.body = { error: "El estudiante sólo puede actualizar su foto, contraseña, contactos y dirección" };
        return;
      }
    }

    if (cuenta?.username !== undefined) {
      const usernameCheck = validateUsernamePolicy(cuenta.username);
      if (!usernameCheck.valid) {
        ctx.response.status = 400;
        ctx.response.body = { error: usernameCheck.error, field: "username" };
        return;
      }
    }

    if (rolId !== undefined) {
      const roleRes = await query<{ id: bigint; rol: string }>(
        `SELECT id, rol FROM roles WHERE id = $1 AND COALESCE(activo, true) = true`,
        [rolId],
      );
      if (roleRes.rows.length === 0) {
        ctx.response.status = 400;
        ctx.response.body = { error: `Rol con id=${rolId} no existe` };
        return;
      }
      if (viewerRole === "control" && !ROLES_GESTIONABLES_CONTROL.has(roleRes.rows[0].rol.trim().toLowerCase())) {
        ctx.response.status = 403;
        ctx.response.body = { error: "Control no puede asignar el rol de director" };
        return;
      }
    }

    const { newFotoUrl, updatedDocumentos } = await uploadUsuarioMedia({
      currentFotoUrl: current.foto_url,
      nombre: (nombre ?? current.nombre).trim(),
      apellidoPaterno: (apellidoPaterno ?? current.apellido_paterno).trim(),
      rolNombre: targetRole,
      fotoBytes,
      fotoExt,
      documentos,
      documentFiles,
      nivel: dynamicData.nivel || dynamicData.estudiante?.nivel,
      grado: dynamicData.grado || dynamicData.estudiante?.grado,
    });

    await sTransaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (nombre !== undefined) { sets.push(`nombre = $${p++}`); vals.push(nombre); }
      if (apellidoPaterno !== undefined) { sets.push(`apellido_paterno = $${p++}`); vals.push(apellidoPaterno); }
      if (apellidoMaterno !== undefined) { sets.push(`apellido_materno = $${p++}`); vals.push(apellidoMaterno); }
      if (nacimiento !== undefined) { sets.push(`nacimiento = $${p++}`); vals.push(nacimiento); }
      if (genero !== undefined) { sets.push(`genero = $${p++}`); vals.push(genero); }
      if (estado !== undefined) {
        const estadoFinal = estado === 0 || estado === "inactivo"
          ? "inactivo"
          : estado === 2 || estado === "bloqueado"
          ? "bloqueado"
          : "activo";
        sets.push(`estado = $${p++}`);
        vals.push(estadoFinal);
      }
      if (rolId !== undefined) { sets.push(`rol_id = $${p++}`); vals.push(rolId); }
      if (fotoBytes !== null) { sets.push(`foto_url = $${p++}`); vals.push(newFotoUrl); }

      if (sets.length > 0) {
        sets.push("fecha_actualizacion = NOW()");
        await tx.queryObject(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = $${p}`, [...vals, id]);
      }

      if (estado !== undefined) {
        const active = normalizedEstado === "activo";
        await tx.queryObject(`UPDATE maestros SET estado = $2, fecha_actualizacion = NOW() WHERE usuario_id = $1`, [id, active ? "activo" : "inactivo"]);
        await tx.queryObject(`UPDATE estudiantes SET estado = $2, fecha_actualizacion = NOW() WHERE usuario_id = $1`, [id, active ? "activo" : "retirado"]);
      }

      if (cuenta) {
        const cSets: string[] = [];
        const cVals: unknown[] = [];
        let cp = 1;
        if (cuenta.username !== undefined) { cSets.push(`username = $${cp++}`); cVals.push(cuenta.username); }
        if (cuenta.email !== undefined) { cSets.push(`email = $${cp++}`); cVals.push(cuenta.email); }
        if (cuenta.password) {
          // deno-lint-ignore no-explicit-any
          const hash = await (bcrypt as any).hash(cuenta.password, 12);
          cSets.push(`password_hash = $${cp++}`);
          cVals.push(hash);
        }
        if (cSets.length > 0) {
          cSets.push("fecha_actualizacion = NOW()");
          await tx.queryObject(`UPDATE usuario_cuenta SET ${cSets.join(", ")} WHERE usuario_id = $${cp}`, [...cVals, id]);
        }
      }

      if (direccion) {
        await tx.queryObject(
          `INSERT INTO usuario_direcciones (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia, fecha_actualizacion)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (usuario_id) DO UPDATE SET
             zona = EXCLUDED.zona, distrito = EXCLUDED.distrito, bloque = EXCLUDED.bloque,
             calle = EXCLUDED.calle, numero = EXCLUDED.numero, edificio = EXCLUDED.edificio,
             piso = EXCLUDED.piso, referencia = EXCLUDED.referencia, fecha_actualizacion = NOW()`,
          [id, direccion.zona, direccion.distrito ?? null, direccion.bloque ?? null, direccion.calle ?? null,
           direccion.numero ?? null, direccion.edificio ?? null, direccion.piso ?? null, direccion.referencia ?? null],
        );
      }

      if (Array.isArray(contactos)) {
        await tx.queryObject("DELETE FROM usuario_contactos WHERE usuario_id = $1", [id]);
        for (const cont of contactos) {
          await tx.queryObject(
            "INSERT INTO usuario_contactos (usuario_id, tipo, contenido, principal) VALUES ($1, $2, $3, $4)",
            [id, cont.tipo, cont.contenido, cont.principal ?? false],
          );
        }
      }

      await syncUsuarioRoleProfiles(tx, id, maestro, dynamicData, updatedDocumentos);
    });

    const onboarding = isSelf && ROLES_ONBOARDING.has(targetRole)
      ? await syncSelfOnboardingStatus(id)
      : undefined;

    ctx.response.status = 200;
    broadcastUserEvent({ action: "updated", userId: id });
    ctx.response.body = {
      message: "Usuario actualizado correctamente",
      fotoUrl: await resolveMediaUrl(newFotoUrl),
      onboarding,
    };
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    const cause = (err as any)?.cause as any;
    const uploadStatus = (err as { status?: number })?.status;
    const msg = [(err as Error)?.message ?? "", cause?.message ?? ""].join(" ").toLowerCase();
    const constraint = [
      String((err as { constraint?: string })?.constraint ?? ""),
      String(cause?.fields?.constraint ?? ""),
      String(cause?.constraint ?? ""),
    ].join(" ").toLowerCase();

    console.error("[updateUsuario]", err);
    if (uploadStatus && uploadStatus >= 400) {
      ctx.response.status = uploadStatus;
      ctx.response.body = { error: (err as Error)?.message ?? "No se pudo procesar el archivo" };
      return;
    }

    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505") || constraint.trim().length > 0) {
      const [field, error] =
        constraint.includes("username") || msg.includes("username") || msg.includes("uq_usuario_username")
          ? ["username", "El username ya está registrado"]
          : constraint.includes("email") || msg.includes("email") || msg.includes("uq_usuario_email")
          ? ["email", "El correo electrónico ya está registrado"]
          : constraint.includes("numero_doc") || msg.includes("numero_doc") || msg.includes("documentos")
          ? ["numeroDoc", "El número de documento ya está registrado para otro usuario"]
          : ["general", "Ya existe un dato registrado para otro usuario"];
      ctx.response.status = 409;
      ctx.response.body = { error, message: error, field };
      return;
    }

    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
