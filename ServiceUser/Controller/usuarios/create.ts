import { Context } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { uploadImage } from "../../connects/Storage/minio.ts";
import { serialize } from "../../utils/serialize.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";
// deno-lint-ignore no-explicit-any
import sharp from "sharp";

/**
 * POST /usuarios
 *
 * Acepta multipart/form-data con:
 *   - campo "datos": JSON string con los datos del usuario
 *   - campo "foto": archivo de imagen (cualquier formato → se convierte a WebP)
 *
 * O bien application/json sin foto.
 *
 * El nombre de la imagen en MinIO sigue el patrón:
 *   {rol}_{username}_{timestamp_unix}.webp
 */
export async function createUsuario(ctx: Context): Promise<void> {
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // ── Parseo del cuerpo ────────────────────────────────────────────────────
    // deno-lint-ignore no-explicit-any
    let datos: Record<string, any>;
    let fotoBytes: Uint8Array | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.request.body.formData();

      const datosField = form.get("datos");
      if (!datosField || typeof datosField !== "string") {
        ctx.response.status = 400;
        ctx.response.body = {
          error: "El campo 'datos' (JSON string) es obligatorio en multipart",
        };
        return;
      }
      datos = JSON.parse(datosField);

      const foto = form.get("foto");
      if (foto && foto instanceof File) {
        fotoBytes = new Uint8Array(await foto.arrayBuffer());
      }
    } else {
      datos = await ctx.request.body.json();
    }

    // ── Validación de campos obligatorios ────────────────────────────────────
    const {
      rolId,
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

    if (
      !rolId || !nombre || !apellidoPaterno || !apellidoMaterno ||
      !nacimiento || !cuenta?.username || !cuenta?.email || !cuenta?.password
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Faltan campos obligatorios: rolId, nombre, apellidoPaterno, apellidoMaterno, nacimiento, cuenta.{username, email, password}",
      };
      return;
    }

    // ── Obtener nombre del rol para el nombrado de la imagen ─────────────────
    const rolResult = await query<{ id: bigint; rol: string }>(
      `SELECT id, rol FROM roles WHERE id = $1`,
      [rolId],
    );
    if (rolResult.rows.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: `Rol con id=${rolId} no existe` };
      return;
    }
    const rolNombre = rolResult.rows[0].rol.toLowerCase();

    // ── Procesado de imagen → WebP → MinIO ──────────────────────────────────
    let fotoUrl: string | null = null;

    if (fotoBytes !== null) {
      const timestamp = Math.floor(Date.now() / 1000);
      const imageKey =
        `${rolNombre}_${cuenta.username}_${timestamp}.webp`;

      // Conversión a WebP con sharp (calidad 85%)
      // deno-lint-ignore no-explicit-any
      const webpBuffer: Buffer = await (sharp as any)(fotoBytes)
        .webp({ quality: 85 })
        .toBuffer();

      fotoUrl = await uploadImage(imageKey, new Uint8Array(webpBuffer));
    }

    // ── Hash de contraseña ───────────────────────────────────────────────────
    // deno-lint-ignore no-explicit-any
    const passwordHash: string = await (bcrypt as any).hash(cuenta.password, 12);

    // ── Inserción en transacción ─────────────────────────────────────────────
    const usuarioId = await sTransaction(async (tx) => {
      // 1. Tabla principal usuarios
      const usuarioRes = await tx.queryObject<{ id: bigint }>(`
        INSERT INTO usuarios
          (rol_id, nombre, apellido_paterno, apellido_materno,
           nacimiento, genero, foto_url, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        rolId,
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        nacimiento,
        genero ?? null,
        fotoUrl,
        estado ?? 1,
      ]);
      const uid = usuarioRes.rows[0].id;

      // 2. Cuenta de acceso
      await tx.queryObject(`
        INSERT INTO usuario_cuenta (usuario_id, username, email, password_hash)
        VALUES ($1, $2, $3, $4)
      `, [uid, cuenta.username, cuenta.email, passwordHash]);

      // 3. Documentos (opcional, array)
      if (Array.isArray(documentos)) {
        for (const doc of documentos) {
          await tx.queryObject(`
            INSERT INTO usuario_doc (usuario_id, tipo_doc, numero_doc, doc_url)
            VALUES ($1, $2, $3, $4)
          `, [uid, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null]);
        }
      }

      // 4. Dirección (opcional)
      if (direccion) {
        await tx.queryObject(`
          INSERT INTO usuario_dir
            (usuario_id, zona, distrito, bloque, calle, numero,
             edificio, piso, referencia)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          uid,
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

      // 5. Contactos (opcional, array)
      if (Array.isArray(contactos)) {
        for (const cont of contactos) {
          await tx.queryObject(`
            INSERT INTO usuario_cont (usuario_id, tipo, contenido)
            VALUES ($1, $2, $3)
          `, [uid, cont.tipo, cont.contenido]);
        }
      }

      // 6. Si el rol es "profesor", insertar en tabla maestros
      if (rolNombre === "profesor") {
        const hoy = new Date().toISOString().split("T")[0];
        await tx.queryObject(`
          INSERT INTO maestros (usuario_id, especialidad, fecha_contratacion)
          VALUES ($1, $2, $3)
        `, [
          uid,
          maestro?.especialidad ?? null,
          maestro?.fechaContratacion ?? hoy,
        ]);
      }

      return uid;
    });

    ctx.response.status = 201;
    ctx.response.body = serialize({
      message: "Usuario creado correctamente",
      id: usuarioId,
      fotoUrl,
    });
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    console.error("[createUsuario]", err);

    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      ctx.response.status = 409;
      ctx.response.body = {
        error: "Ya existe un usuario con ese username, email o número de documento",
      };
      return;
    }
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
