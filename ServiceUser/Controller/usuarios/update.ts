import { RouterContext } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { deleteFile, getKeyFromUrl, uploadImage } from "../../connects/Storage/minio.ts";
import { buildPhotoKey, detectImageExt, mimeFromExt } from "../../utils/fileNaming.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

/**
 * PUT /usuarios/:id
 *
 * Regla de imagen:
 *   - Si viene nueva foto se genera el key deterministico:
 *       nombre_apellido_rolAbr_perfil.<ext>
 *   - Si el key anterior difiere (distinta extension o nombre anterior),
 *     se elimina el objeto antiguo de MinIO y se sube el nuevo.
 *   - Si el key es igual se sobreescribe en MinIO (sin borrar/reinsertar).
 */
export async function updateUsuario(ctx: RouterContext<"/usuarios/:id">): Promise<void> {
  try {
    const id = ctx.params.id;
    if (!/^\d+$/.test(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "El id debe ser numerico" };
      return;
    }

const contentType = ctx.request.headers.get("content-type") ?? "";

    // deno-lint-ignore no-explicit-any
    let datos: Record<string, any> = {};
    let fotoBytes: Uint8Array | null = null;
    let fotoExt: "png" | "jpg" | null = null;

    const hasFiles = contentType.includes("multipart/form-data");

    if (hasFiles) {
      try {
        const form = await ctx.request.body.formData();
        const datosField = form.get("datos");
        if (datosField && typeof datosField === "string") {
          datos = JSON.parse(datosField);
        }
        const foto = form.get("foto");
        if (foto && foto instanceof File && foto.size > 0) {
          fotoBytes = new Uint8Array(await foto.arrayBuffer());
          fotoExt = detectImageExt(fotoBytes);
          if (!fotoExt) {
            ctx.response.status = 400;
            ctx.response.body = { error: "La foto debe ser una imagen PNG o JPG valida" };
            return;
          }
        }
      } catch (e) {
        // Si falla el parseo multipart, intentar como JSON
        console.warn("[updateUsuario] Error parseando multipart, intentando JSON:", e);
        datos = await ctx.request.body.json();
      }
    } else {
      datos = await ctx.request.body.json();
    }

    // Obtener estado actual del usuario (nombre, apellido, rol, foto_url)
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
      ctx.response.body = { error: "Usuario con id=" + id + " no encontrado" };
      return;
    }

    const current = currentRes.rows[0];
    if (ctx.state.auth?.role === "control" &&
      !["profesor", "maestro", "docente", "estudiante"].includes(current.rol.trim().toLowerCase())) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Control solo puede gestionar profesores y estudiantes" };
      return;
    }

    const { nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado, cuenta, documentos, direccion, contactos, maestro, rolId } = datos;

    if (rolId !== undefined) {
      const roleRes = await query<{ id: bigint; rol: string }>(`SELECT id, rol FROM roles WHERE id = $1`, [rolId]);
      if (roleRes.rows.length === 0) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Rol con id=" + rolId + " no existe" };
        return;
      }
      if (ctx.state.auth?.role === "control" &&
        !["profesor", "maestro", "docente", "estudiante"].includes(roleRes.rows[0].rol.trim().toLowerCase())) {
        ctx.response.status = 403;
        ctx.response.body = { error: "Control solo puede asignar roles de profesor o estudiante" };
        return;
      }
    }

    // Subir nueva foto si se proporciono
    let newFotoUrl: string | null = current.foto_url;

    if (fotoBytes !== null && fotoExt !== null) {
      // Usar nombre/apellido nuevos si se actualizan en este mismo request
      const usedNombre = (nombre ?? current.nombre).trim();
      const usedApellido = (apellidoPaterno ?? current.apellido_paterno).trim();
      const rolNombre = current.rol.toLowerCase().trim();

      const newKey = buildPhotoKey(usedNombre, usedApellido, rolNombre, fotoExt);
      const oldKey = current.foto_url ? getKeyFromUrl(current.foto_url) : null;

      // Si el key cambio (diferente extension o nombre), eliminar el anterior
      if (oldKey && oldKey !== newKey) {
        try {
          await deleteFile(oldKey);
        } catch (e) {
          console.warn("[updateUsuario] No se pudo borrar foto anterior:", e);
        }
      }

      newFotoUrl = await uploadImage(newKey, fotoBytes, mimeFromExt(fotoExt));
    }

    // Actualizacion en transaccion
    await sTransaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (nombre !== undefined) { sets.push("nombre = $" + p++); vals.push(nombre); }
      if (apellidoPaterno !== undefined) { sets.push("apellido_paterno = $" + p++); vals.push(apellidoPaterno); }
      if (apellidoMaterno !== undefined) { sets.push("apellido_materno = $" + p++); vals.push(apellidoMaterno); }
      if (nacimiento !== undefined) { sets.push("nacimiento = $" + p++); vals.push(nacimiento); }
      if (genero !== undefined) { sets.push("genero = $" + p++); vals.push(genero); }
      if (estado !== undefined) { sets.push("estado = $" + p++); vals.push(estado); }
      if (rolId !== undefined) { sets.push("rol_id = $" + p++); vals.push(rolId); }
      if (fotoBytes !== null) { sets.push("foto_url = $" + p++); vals.push(newFotoUrl); }

      if (sets.length > 0) {
        sets.push("fecha_actualizacion = NOW()");
        await tx.queryObject("UPDATE usuarios SET " + sets.join(", ") + " WHERE id = $" + p, [...vals, id]);
      }

      if (cuenta) {
        const cSets: string[] = [];
        const cVals: unknown[] = [];
        let cp = 1;
        if (cuenta.username !== undefined) { cSets.push("username = $" + cp++); cVals.push(cuenta.username); }
        if (cuenta.email !== undefined) { cSets.push("email = $" + cp++); cVals.push(cuenta.email); }
        if (cuenta.password !== undefined) {
          // deno-lint-ignore no-explicit-any
          const hash = await (bcrypt as any).hash(cuenta.password, 12);
          cSets.push("password_hash = $" + cp++);
          cVals.push(hash);
        }
        if (cSets.length > 0) {
          await tx.queryObject("UPDATE usuario_cuenta SET " + cSets.join(", ") + " WHERE usuario_id = $" + cp, [...cVals, id]);
        }
      }

      if (direccion) {
        await tx.queryObject(`
          INSERT INTO usuario_dir (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (usuario_id) DO UPDATE SET
            zona = EXCLUDED.zona, distrito = EXCLUDED.distrito, bloque = EXCLUDED.bloque,
            calle = EXCLUDED.calle, numero = EXCLUDED.numero, edificio = EXCLUDED.edificio,
            piso = EXCLUDED.piso, referencia = EXCLUDED.referencia
        `, [id, direccion.zona, direccion.distrito ?? null, direccion.bloque ?? null,
          direccion.calle ?? null, direccion.numero ?? null, direccion.edificio ?? null,
          direccion.piso ?? null, direccion.referencia ?? null]);
      }

      if (Array.isArray(contactos)) {
        await tx.queryObject("DELETE FROM usuario_cont WHERE usuario_id = $1", [id]);
        for (const cont of contactos) {
          await tx.queryObject("INSERT INTO usuario_cont (usuario_id, tipo, contenido) VALUES ($1, $2, $3)", [id, cont.tipo, cont.contenido]);
        }
      }

      if (maestro?.especialidad !== undefined) {
        await tx.queryObject("UPDATE maestros SET especialidad = $1 WHERE usuario_id = $2", [maestro.especialidad, id]);
      }
    });

    ctx.response.status = 200;
    broadcastUserEvent({ action: "updated", userId: id });
    ctx.response.body = { message: "Usuario actualizado correctamente", fotoUrl: newFotoUrl };
  } catch (err) {
    console.error("[updateUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
