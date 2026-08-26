import { RouterContext } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import {
  getKeyFromUrl,
  uploadImage,
} from "../../connects/Storage/minio.ts";
import { serialize } from "../../utils/serialize.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";
// deno-lint-ignore no-explicit-any
import sharp from "sharp";

/**
 * PUT /usuarios/:id
 *
 * Acepta multipart/form-data o application/json.
 *
 * Regla de imagen:
 *   - Si viene nueva foto, se SOBREESCRIBE el objeto en MinIO con el MISMO KEY
 *     (el nombre no cambia). La URL en la BD tampoco cambia.
 *   - Si el usuario no tenía foto previa, se crea con el patrón
 *     {rol}_{username}_{timestamp}.webp
 */
export async function updateUsuario(
  ctx: RouterContext<"/usuarios/:id">,
): Promise<void> {
  try {
    const id = ctx.params.id;
    const contentType = ctx.request.headers.get("content-type") ?? "";

    //Parseo del cuerpo
    // deno-lint-ignore no-explicit-any
    let datos: Record<string, any> = {};
    let fotoBytes: Uint8Array | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();
      const datosField = form.get("datos");
      if (datosField && typeof datosField === "string") {
        datos = JSON.parse(datosField);
      }
      const foto = form.get("foto");
      if (foto && foto instanceof File) {
        fotoBytes = new Uint8Array(await foto.arrayBuffer());
      }
    } else {
      datos = await ctx.request.body.json();
    }

    //Obtener estado actual del usuario
    const currentRes = await query<{
      foto_url: string | null;
      username: string;
      rol: string;
    }>(
      `SELECT u.foto_url, uc.username, r.rol
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

    //Procesado de imagen (sobreescribir mismo key)
    let newFotoUrl: string | null = current.foto_url;

    if (fotoBytes !== null) {
      let imageKey: string;

      if (current.foto_url) {
        // Conservar el nombre existente: sobreescribir en MinIO
        imageKey = getKeyFromUrl(current.foto_url) ??
          `${current.rol.toLowerCase()}_${current.username}_${Math.floor(Date.now() / 1000)}.webp`;
      } else {
        // Primera foto: crear nombre con patrón
        imageKey =
          `${current.rol.toLowerCase()}_${current.username}_${Math.floor(Date.now() / 1000)}.webp`;
      }

      // deno-lint-ignore no-explicit-any
      const webpBuffer: Buffer = await (sharp as any)(fotoBytes)
        .webp({ quality: 85 })
        .toBuffer();

      newFotoUrl = await uploadImage(imageKey, new Uint8Array(webpBuffer));
    }

    //Actualización en transacción
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      nacimiento,
      genero,
      estado,
      cuenta,
      documentos,
      direccion,
      contactos,
      maestro,
    } = datos;

    await sTransaction(async (tx) => {
      // 1. Tabla usuarios (campos opcionales)
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (nombre !== undefined) { sets.push(`nombre = $${p++}`); vals.push(nombre); }
      if (apellidoPaterno !== undefined) { sets.push(`apellido_paterno = $${p++}`); vals.push(apellidoPaterno); }
      if (apellidoMaterno !== undefined) { sets.push(`apellido_materno = $${p++}`); vals.push(apellidoMaterno); }
      if (nacimiento !== undefined) { sets.push(`nacimiento = $${p++}`); vals.push(nacimiento); }
      if (genero !== undefined) { sets.push(`genero = $${p++}`); vals.push(genero); }
      if (estado !== undefined) { sets.push(`estado = $${p++}`); vals.push(estado); }
      if (fotoBytes !== null) { sets.push(`foto_url = $${p++}`); vals.push(newFotoUrl); }

      if (sets.length > 0) {
        sets.push(`fecha_actualizacion = NOW()`);
        await tx.queryObject(
          `UPDATE usuarios SET ${sets.join(", ")} WHERE id = $${p}`,
          [...vals, id],
        );
      }

      // 2. Cuenta de acceso
      if (cuenta) {
        const cSets: string[] = [];
        const cVals: unknown[] = [];
        let cp = 1;
        if (cuenta.username !== undefined) { cSets.push(`username = $${cp++}`); cVals.push(cuenta.username); }
        if (cuenta.email !== undefined) { cSets.push(`email = $${cp++}`); cVals.push(cuenta.email); }
        if (cuenta.password !== undefined) {
          // deno-lint-ignore no-explicit-any
          const hash = await (bcrypt as any).hash(cuenta.password, 12);
          cSets.push(`password_hash = $${cp++}`);
          cVals.push(hash);
        }
        if (cSets.length > 0) {
          await tx.queryObject(
            `UPDATE usuario_cuenta SET ${cSets.join(", ")} WHERE usuario_id = $${cp}`,
            [...cVals, id],
          );
        }
      }

      // 3. Dirección (upsert)
      if (direccion) {
        await tx.queryObject(`
          INSERT INTO usuario_dir
            (usuario_id, zona, distrito, bloque, calle, numero,
             edificio, piso, referencia)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (usuario_id) DO UPDATE SET
            zona        = EXCLUDED.zona,
            distrito    = EXCLUDED.distrito,
            bloque      = EXCLUDED.bloque,
            calle       = EXCLUDED.calle,
            numero      = EXCLUDED.numero,
            edificio    = EXCLUDED.edificio,
            piso        = EXCLUDED.piso,
            referencia  = EXCLUDED.referencia
        `, [
          id,
          direccion.zona,
          direccion.distrito ?? null,
          direccion.bloque ?? null,
          direccion.calle ?? null,
          direccion.numero ?? null,
          direccion.edificio ?? null,
          direccion.piso ?? null,
          direccion.referencia ?? null,
        ]);
      }

      // 4. Contactos: si se envían, reemplazar todos
      if (Array.isArray(contactos)) {
        await tx.queryObject(
          `DELETE FROM usuario_cont WHERE usuario_id = $1`,
          [id],
        );
        for (const cont of contactos) {
          await tx.queryObject(
            `INSERT INTO usuario_cont (usuario_id, tipo, contenido) VALUES ($1, $2, $3)`,
            [id, cont.tipo, cont.contenido],
          );
        }
      }

      // 5. Maestro (si corresponde)
      if (maestro?.especialidad !== undefined) {
        await tx.queryObject(`
          UPDATE maestros SET especialidad = $1 WHERE usuario_id = $2
        `, [maestro.especialidad, id]);
      }
    });

    ctx.response.status = 200;
    ctx.response.body = {
      message: "Usuario actualizado correctamente",
      fotoUrl: newFotoUrl,
    };
  } catch (err) {
    console.error("[updateUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
