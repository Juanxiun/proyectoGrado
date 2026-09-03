import { RouterContext } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import {
  deleteFile,
  getKeyFromUrl,
  resolveMediaUrl,
  uploadFile,
  uploadImage,
} from "../../connects/Storage/minio.ts";
import {
  buildDocKey,
  buildPhotoKey,
  detectImageExt,
  mimeFromExt,
} from "../../utils/fileNaming.ts";
import {
  formFieldAsString,
  readFilePart,
  readMultipartForm,
} from "../../utils/multipart.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

/**
 * PUT /usuarios/:id
 *
 * Acepta multipart/form-data o application/json.
 *
 * multipart/form-data:
 *   - campo "datos": JSON string con los datos del usuario
 *   - campo "foto": archivo de imagen (perfil) - opcional
 *   - campos "doc_file_{index}": archivo PDF para cada documento - opcional
 */
export async function updateUsuario(
  ctx: RouterContext<"/usuarios/:id">,
): Promise<void> {
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
    const documentFiles: Array<
      { index: number; bytes: Uint8Array; name: string }
    > = [];

    const hasFiles = contentType.toLowerCase().includes("multipart/form-data");

    if (hasFiles) {
      try {
        const form = await readMultipartForm(ctx);
        const datosRaw = await formFieldAsString(form.get("datos"));

        if (!datosRaw) {
          ctx.response.status = 400;
          ctx.response.body = {
            error: "El campo 'datos' (JSON string) es obligatorio en multipart",
          };
          return;
        }

        datos = JSON.parse(datosRaw);

        const fotoPart = await readFilePart(form.get("foto"));
        if (fotoPart) {
          fotoBytes = fotoPart.bytes;
          fotoExt = detectImageExt(fotoBytes);
          if (!fotoExt) {
            ctx.response.status = 400;
            ctx.response.body = {
              error: "La foto debe ser una imagen PNG o JPG valida",
            };
            return;
          }
        }

        if (Array.isArray(datos.documentos)) {
          for (let i = 0; i < datos.documentos.length; i++) {
            const doc = datos.documentos[i];
            const docPart = await readFilePart(
              form.get("doc_file_" + i) || form.get("doc_file_" + doc.tipoDoc),
            );
            if (docPart) {
              const isPdf = docPart.bytes.length >= 4 &&
                String.fromCharCode(...docPart.bytes.slice(0, 4)) === "%PDF";
              if (!isPdf) {
                ctx.response.status = 400;
                ctx.response.body = {
                  error: "El documento " + (i + 1) + " debe ser un PDF valido",
                };
                return;
              }
              documentFiles.push({
                index: i,
                bytes: docPart.bytes,
                name: docPart.name,
              });
            }
          }
        }
      } catch (e) {
        console.error("[updateUsuario] Error parseando multipart:", e);
        ctx.response.status = 400;
        ctx.response.body = {
          error: "Error procesando el formulario multipart: " +
            (e instanceof Error ? e.message : String(e)),
        };
        return;
      }
    } else {
      datos = await ctx.request.body.json();
    }

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
    if (
      ctx.state.auth?.role === "control" &&
      !["profesor", "maestro", "docente", "estudiante"].includes(
        current.rol.trim().toLowerCase(),
      )
    ) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Control solo puede gestionar profesores y estudiantes",
      };
      return;
    }

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
      rolId,
    } = datos;

    if (rolId !== undefined) {
      const roleRes = await query<{ id: bigint; rol: string }>(
        `SELECT id, rol FROM roles WHERE id = $1`,
        [rolId],
      );
      if (roleRes.rows.length === 0) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Rol con id=" + rolId + " no existe" };
        return;
      }
      if (
        ctx.state.auth?.role === "control" &&
        !["profesor", "maestro", "docente", "estudiante"].includes(
          roleRes.rows[0].rol.trim().toLowerCase(),
        )
      ) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Control solo puede asignar roles de profesor o estudiante",
        };
        return;
      }
    }

    let newFotoUrl: string | null = current.foto_url;

    if (fotoBytes !== null && fotoExt !== null) {
      const usedNombre = (nombre ?? current.nombre).trim();
      const usedApellido = (apellidoPaterno ?? current.apellido_paterno).trim();
      const rolNombre = current.rol.toLowerCase().trim();

      const newKey = buildPhotoKey(
        usedNombre,
        usedApellido,
        rolNombre,
        fotoExt,
      );
      const oldKey = current.foto_url ? getKeyFromUrl(current.foto_url) : null;

      if (oldKey && oldKey !== newKey) {
        try {
          await deleteFile(oldKey);
        } catch (e) {
          console.warn("[updateUsuario] No se pudo borrar foto anterior:", e);
        }
      }

      newFotoUrl = await uploadImage(newKey, fotoBytes, mimeFromExt(fotoExt));
    }

    let updatedDocumentos = documentos;
    if (Array.isArray(documentos) && documentFiles.length > 0) {
      updatedDocumentos = [...documentos];
      const usedNombre = (nombre ?? current.nombre).trim();
      const usedApellido = (apellidoPaterno ?? current.apellido_paterno).trim();
      const rolNombre = current.rol.toLowerCase().trim();

      for (const file of documentFiles) {
        const doc = updatedDocumentos[file.index];
        if (doc) {
          const docKey = buildDocKey(
            usedNombre,
            usedApellido,
            rolNombre,
            doc.tipoDoc,
          );
          doc.docUrl = await uploadFile(docKey, file.bytes, "application/pdf");
        }
      }
    }

    await sTransaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let p = 1;

      if (nombre !== undefined) {
        sets.push("nombre = $" + p++);
        vals.push(nombre);
      }
      if (apellidoPaterno !== undefined) {
        sets.push("apellido_paterno = $" + p++);
        vals.push(apellidoPaterno);
      }
      if (apellidoMaterno !== undefined) {
        sets.push("apellido_materno = $" + p++);
        vals.push(apellidoMaterno);
      }
      if (nacimiento !== undefined) {
        sets.push("nacimiento = $" + p++);
        vals.push(nacimiento);
      }
      if (genero !== undefined) {
        sets.push("genero = $" + p++);
        vals.push(genero);
      }
      if (estado !== undefined) {
        sets.push("estado = $" + p++);
        vals.push(estado);
      }
      if (rolId !== undefined) {
        sets.push("rol_id = $" + p++);
        vals.push(rolId);
      }
      if (fotoBytes !== null) {
        sets.push("foto_url = $" + p++);
        vals.push(newFotoUrl);
      }

      if (sets.length > 0) {
        sets.push("fecha_actualizacion = NOW()");
        await tx.queryObject(
          "UPDATE usuarios SET " + sets.join(", ") + " WHERE id = $" + p,
          [...vals, id],
        );
      }

      if (cuenta) {
        const cSets: string[] = [];
        const cVals: unknown[] = [];
        let cp = 1;
        if (cuenta.username !== undefined) {
          cSets.push("username = $" + cp++);
          cVals.push(cuenta.username);
        }
        if (cuenta.email !== undefined) {
          cSets.push("email = $" + cp++);
          cVals.push(cuenta.email);
        }
        if (cuenta.password !== undefined && cuenta.password) {
          // deno-lint-ignore no-explicit-any
          const hash = await (bcrypt as any).hash(cuenta.password, 12);
          cSets.push("password_hash = $" + cp++);
          cVals.push(hash);
        }
        if (cSets.length > 0) {
          await tx.queryObject(
            "UPDATE usuario_cuenta SET " + cSets.join(", ") +
              " WHERE usuario_id = $" + cp,
            [...cVals, id],
          );
        }
      }

      if (direccion) {
        await tx.queryObject(
          `
          INSERT INTO usuario_dir (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (usuario_id) DO UPDATE SET
            zona = EXCLUDED.zona, distrito = EXCLUDED.distrito, bloque = EXCLUDED.bloque,
            calle = EXCLUDED.calle, numero = EXCLUDED.numero, edificio = EXCLUDED.edificio,
            piso = EXCLUDED.piso, referencia = EXCLUDED.referencia
        `,
          [
            id,
            direccion.zona,
            direccion.distrito ?? null,
            direccion.bloque ?? null,
            direccion.calle ?? null,
            direccion.numero ?? null,
            direccion.edificio ?? null,
            direccion.piso ?? null,
            direccion.referencia ?? null,
          ],
        );
      }

      if (Array.isArray(contactos)) {
        await tx.queryObject("DELETE FROM usuario_cont WHERE usuario_id = $1", [
          id,
        ]);
        for (const cont of contactos) {
          await tx.queryObject(
            "INSERT INTO usuario_cont (usuario_id, tipo, contenido) VALUES ($1, $2, $3)",
            [id, cont.tipo, cont.contenido],
          );
        }
      }

      if (maestro?.especialidad !== undefined) {
        await tx.queryObject(
          "UPDATE maestros SET especialidad = $1 WHERE usuario_id = $2",
          [maestro.especialidad, id],
        );
      }

      if (Array.isArray(updatedDocumentos)) {
        for (const doc of updatedDocumentos) {
          if (!doc?.tipoDoc || !doc?.numeroDoc) continue;
          if (doc.id) {
            await tx.queryObject(
              `UPDATE usuario_doc
               SET tipo_doc = $1, numero_doc = $2, doc_url = COALESCE($3, doc_url)
               WHERE id = $4 AND usuario_id = $5`,
              [doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null, doc.id, id],
            );
          } else {
            const existing = await tx.queryObject<{ id: bigint }>(
              `SELECT id FROM usuario_doc WHERE usuario_id = $1 AND tipo_doc = $2 LIMIT 1`,
              [id, doc.tipoDoc],
            );
            if (existing.rows.length > 0) {
              await tx.queryObject(
                `UPDATE usuario_doc
                 SET numero_doc = $1, doc_url = COALESCE($2, doc_url)
                 WHERE id = $3`,
                [doc.numeroDoc, doc.docUrl ?? null, existing.rows[0].id],
              );
            } else {
              await tx.queryObject(
                `INSERT INTO usuario_doc (usuario_id, tipo_doc, numero_doc, doc_url)
                 VALUES ($1, $2, $3, $4)`,
                [id, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null],
              );
            }
          }
        }
      }
    });

    ctx.response.status = 200;
    broadcastUserEvent({ action: "updated", userId: id });
    ctx.response.body = {
      message: "Usuario actualizado correctamente",
      fotoUrl: await resolveMediaUrl(newFotoUrl),
    };
  } catch (err) {
    console.error("[updateUsuario]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
