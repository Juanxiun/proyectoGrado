import { Context } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { resolveMediaUrl, uploadFile, uploadImage } from "../../connects/Storage/minio.ts";
import { formFieldAsString, readFilePart, readMultipartForm } from "../../utils/multipart.ts";
import { serialize } from "../../utils/serialize.ts";
import {
  buildDocKey,
  buildPhotoKey,
  detectImageExt,
  mimeFromExt,
} from "../../utils/fileNaming.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";
import { broadcastUserEvent } from "../../services/websocket.service.ts";
import { generateUsername, generateEmail, generatePassword } from "../../utils/username.ts";

/**
 * POST /usuarios
 *
 * Acepta multipart/form-data con:
 *   - campo "datos": JSON string con los datos del usuario
 *   - campo "foto":  archivo PNG o JPG (obligatorio)
 *   - campos "doc_file_{index}": archivos PDF para cada documento
 *
 * La imagen se sube a MinIO con el nombre:
 *   nombre_apellido_<rolAbr>_perfil.<ext>
 * Los documentos con el nombre:
 *   nombre_apellido_<rolAbr>_<tipoDoc>.pdf
 */
export async function createUsuario(ctx: Context): Promise<void> {
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // deno-lint-ignore no-explicit-any
    let datos: Record<string, any>;
    let fotoBytes: Uint8Array | null = null;
    let fotoExt: "png" | "jpg" | null = null;

    let documentFiles: Array<{ index: number; bytes: Uint8Array; name: string }> = [];

    if (contentType.toLowerCase().includes("multipart/form-data")) {
      const form = await readMultipartForm(ctx);

      const datosField = await formFieldAsString(form.get("datos"));
      if (!datosField) {
        ctx.response.status = 400;
        ctx.response.body = { error: "El campo 'datos' (JSON string) es obligatorio en multipart" };
        return;
      }
      datos = JSON.parse(datosField);

      const foto = await readFilePart(form.get("foto"));
      if (!foto) {
        ctx.response.status = 400;
        ctx.response.body = { error: "La foto es obligatoria y debe ser PNG o JPG" };
        return;
      }

      fotoBytes = foto.bytes;
      fotoExt = detectImageExt(fotoBytes);

      if (!fotoExt) {
        ctx.response.status = 400;
        ctx.response.body = { error: "La foto debe ser una imagen PNG o JPG valida (formato no reconocido)" };
        return;
      }

      if (Array.isArray(datos.documentos)) {
        for (let i = 0; i < datos.documentos.length; i++) {
          const doc = datos.documentos[i];
          const docFile = await readFilePart(form.get("doc_file_" + i) || form.get("doc_file_" + doc.tipoDoc));
          if (docFile) {
            const isPdf = docFile.bytes.length >= 4 && String.fromCharCode(...docFile.bytes.slice(0, 4)) === "%PDF";
            if (!isPdf) {
              ctx.response.status = 400;
              ctx.response.body = { error: "El documento " + (i + 1) + " debe ser un PDF valido" };
              return;
            }
            documentFiles.push({ index: i, bytes: docFile.bytes, name: docFile.name });
          }
        }
        if (documentFiles.length !== datos.documentos.length) {
          ctx.response.status = 400;
          ctx.response.body = { error: "Cada documento registrado debe incluir su fotocopia en PDF" };
          return;
        }
      }
    } else {
      datos = await ctx.request.body.json();
    }

    const { rolId, nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado, cuenta, documentos, direccion, contactos, maestro, apoderadoId, parentesco } = datos;

    if (!rolId || !nombre?.trim() || !apellidoPaterno?.trim() || !apellidoMaterno?.trim() || !nacimiento) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Faltan campos obligatorios: rolId, nombre, apellidoPaterno, apellidoMaterno, nacimiento" };
      return;
    }

    if (!fotoBytes) {
      ctx.response.status = 400;
      ctx.response.body = { error: "La foto es obligatoria y debe ser PNG o JPG" };
      return;
    }

    if (cuenta && (typeof cuenta.password !== "string" || cuenta.password.length < 8)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "La contrasena debe tener al menos 8 caracteres" };
      return;
    }

const rolResult = await query<{ id: bigint; rol: string }>(`SELECT id, rol FROM roles WHERE id = $1`, [rolId]);
    if (rolResult.rows.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Rol con id=" + rolId + " no existe" };
      return;
    }
    const rolNombre = rolResult.rows[0].rol.toLowerCase();

    if (ctx.state.auth?.role === "control" && !["profesor", "maestro", "docente", "estudiante"].includes(rolNombre)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Control solo puede registrar profesores y estudiantes" };
      return;
    }

    // Extraer CI de los documentos para generar username
    const ciDoc = Array.isArray(documentos) ? documentos.find((d) => d.tipoDoc === "CI" || d.tipoDoc === "ci") : undefined;
    const ci = ciDoc?.numeroDoc ?? "";

    // Generar username, email y password automáticamente
    const username = generateUsername(nombre, apellidoPaterno, apellidoMaterno, ci);
    const email = generateEmail(username);
    const password = generatePassword(username);

    const cuentaFinal = {
      username,
      email,
      password,
    };

    // Subir foto: nombre_apellido_rolAbr_perfil.<ext>
    const photoKey = buildPhotoKey(nombre, apellidoPaterno, rolNombre, fotoExt!);
    const fotoUrl = await uploadImage(photoKey, fotoBytes, mimeFromExt(fotoExt!));

    // deno-lint-ignore no-explicit-any
    const passwordHash: string | null = await (bcrypt as any).hash(password, 12);

    const usuarioId = await sTransaction(async (tx) => {
      const usuarioRes = await tx.queryObject<{ id: bigint }>(`
        INSERT INTO usuarios (rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, foto_url, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [rolId, nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero ?? null, fotoUrl, estado ?? 1]);
      const uid = usuarioRes.rows[0].id;

      if (cuentaFinal) {
        await tx.queryObject(`INSERT INTO usuario_cuenta (usuario_id, username, email, password_hash) VALUES ($1, $2, $3, $4)`,
          [uid, cuentaFinal.username, cuentaFinal.email, passwordHash]);
      }

      if (Array.isArray(documentos)) {
        for (let i = 0; i < documentos.length; i++) {
          const doc = documentos[i];
          const file = documentFiles.find((f) => f.index === i);
          if (file) {
            const docKey = buildDocKey(nombre, apellidoPaterno, rolNombre, doc.tipoDoc);
            doc.docUrl = await uploadFile(docKey, file.bytes, "application/pdf");
          }
          await tx.queryObject(`INSERT INTO usuario_doc (usuario_id, tipo_doc, numero_doc, doc_url) VALUES ($1, $2, $3, $4)`,
            [uid, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null]);
        }
      }

      if (direccion) {
        await tx.queryObject(`INSERT INTO usuario_dir (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uid, direccion.zona, direccion.distrito ?? null, direccion.bloque ?? null, direccion.calle ?? null, direccion.numero ?? null, direccion.edificio ?? null, direccion.piso ?? null, direccion.referencia ?? null]);
      }

      if (Array.isArray(contactos)) {
        for (const cont of contactos) {
          await tx.queryObject(`INSERT INTO usuario_cont (usuario_id, tipo, contenido) VALUES ($1, $2, $3)`, [uid, cont.tipo, cont.contenido]);
        }
      }

      if (apoderadoId !== undefined) {
        await tx.queryObject(`INSERT INTO estudiante_apoderado (estudiante_id, apoderado_id, parentesco, es_principal) VALUES ($1, $2, $3, TRUE)`,
          [uid, apoderadoId, parentesco ?? "tutor"]);
      }

      if (rolNombre === "profesor") {
        const hoy = new Date().toISOString().split("T")[0];
        await tx.queryObject(`INSERT INTO maestros (usuario_id, especialidad, fecha_contratacion) VALUES ($1, $2, $3)`,
          [uid, maestro?.especialidad ?? null, maestro?.fechaContratacion ?? hoy]);
      }

      return uid;
    });

    ctx.response.status = 201;
    broadcastUserEvent({ action: "created", userId: String(usuarioId) });
    ctx.response.body = serialize({ message: "Usuario creado correctamente", id: usuarioId, username: cuentaFinal?.username ?? null, email: cuentaFinal?.email ?? null, fotoUrl: await resolveMediaUrl(fotoUrl) });
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    console.error("[createUsuario]", err);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      ctx.response.status = 409;
      ctx.response.body = { error: "Ya existe un usuario con ese username, email o numero de documento" };
      return;
    }
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
