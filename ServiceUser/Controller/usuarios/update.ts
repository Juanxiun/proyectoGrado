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
import bcrypt from "bcryptjs";
import { broadcastUserEvent } from "../../services/websocket.service.ts";

interface TutorUpdateInput {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  ci?: string;
  celular?: string;
  telefono?: string;
  parentesco?: string;
}

interface DynamicUsuarioUpdate {
  nivel?: string;
  grado?: string;
  estudiante?: { nivel?: string; grado?: string };
  apoderado?: TutorUpdateInput;
  tutor?: TutorUpdateInput;
  parentesco?: string;
  ocupacion?: string;
}

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
    const dynamicData = datos as DynamicUsuarioUpdate;
    const viewerRole = ctx.state.auth?.role;
    const isSelf = String(ctx.state.auth?.sub) === String(id);
    const targetRole = current.rol.trim().toLowerCase();
    const canManage = viewerRole === "director" ||
      (viewerRole === "control" &&
        ["profesor", "maestro", "docente", "estudiante", "padre", "padres", "apoderado", "tutor", "control", "administrativo", "gerencia", "secretaria", "secretario", "editor"].includes(targetRole));

    if (!isSelf && !canManage) {
      ctx.response.status = 403;
      ctx.response.body = { error: "No tiene permisos para actualizar este usuario" };
      return;
    }

    if (
      viewerRole === "control" && !isSelf &&
      !["profesor", "maestro", "docente", "estudiante", "padre", "padres", "apoderado", "tutor", "control", "administrativo", "gerencia", "secretaria", "secretario", "editor"].includes(targetRole)
    ) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Control puede gestionar docentes, estudiantes y personal de control",
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
    const normalizedEstado = estado === 1 || estado === "activo"
      ? "activo"
      : estado === 0 || estado === "inactivo"
      ? "inactivo"
      : estado;

    // Un estudiante/apoderado sólo administra su foto, contraseña, contactos y dirección.
    // Esta validación es deliberadamente del lado del servidor para que no pueda
    // eludirse modificando la petición desde el navegador.
    if (isSelf && viewerRole === "estudiante") {
      const hasForbiddenPersonalFields = [
        nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado, maestro, rolId,
      ].some((value) => value !== undefined);
      const hasForbiddenAccountFields = cuenta &&
        (cuenta.username !== undefined || cuenta.email !== undefined);
      if (hasForbiddenPersonalFields || hasForbiddenAccountFields || documentos !== undefined) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "El estudiante sólo puede actualizar su foto, contraseña, contactos y dirección",
        };
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
        ctx.response.body = { error: "Rol con id=" + rolId + " no existe" };
        return;
      }
      if (
        ctx.state.auth?.role === "control" &&
        !["profesor", "maestro", "docente", "estudiante", "apoderado", "tutor", "control", "administrativo", "gerencia", "secretaria", "secretario", "editor"].includes(
          roleRes.rows[0].rol.trim().toLowerCase(),
        )
      ) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Control no puede asignar el rol de director",
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

      const nivel = dynamicData.nivel || dynamicData.estudiante?.nivel;
      const grado = dynamicData.grado || dynamicData.estudiante?.grado;
      for (const file of documentFiles) {
        const doc = updatedDocumentos[file.index];
        if (doc) {
          const docKey = buildDocKey(
            usedNombre,
            usedApellido,
            rolNombre,
            doc.tipoDoc,
            nivel,
            grado,
          );
          doc.docUrl = await uploadFile(docKey, file.bytes, "application/pdf");
        }
      }
    }

    let onboarding: { datosPersonalesActualizados: boolean; contactoTutorActualizado: boolean } | undefined;
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
        let estadoFinal: "activo" | "inactivo" | "bloqueado" = "activo";
        if (estado === 0 || estado === "inactivo") {
          estadoFinal = "inactivo";
        } else if (estado === 2 || estado === "bloqueado") {
          estadoFinal = "bloqueado";
        }
        sets.push("estado = $" + p++);
        vals.push(estadoFinal);
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

      if (estado !== undefined) {
        const active = normalizedEstado === "activo";
        await tx.queryObject(
          `UPDATE maestros
           SET estado = $2, fecha_actualizacion = NOW()
           WHERE usuario_id = $1`,
          [id, active ? "activo" : "inactivo"],
        );
        await tx.queryObject(
          `UPDATE estudiantes
           SET estado = $2, fecha_actualizacion = NOW()
           WHERE usuario_id = $1`,
          [id, active ? "activo" : "retirado"],
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
          cSets.push("fecha_actualizacion = NOW()");
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
          INSERT INTO usuario_direcciones (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia, fecha_actualizacion)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          ON CONFLICT (usuario_id) DO UPDATE SET
            zona = EXCLUDED.zona, distrito = EXCLUDED.distrito, bloque = EXCLUDED.bloque,
            calle = EXCLUDED.calle, numero = EXCLUDED.numero, edificio = EXCLUDED.edificio,
            piso = EXCLUDED.piso, referencia = EXCLUDED.referencia,
            fecha_actualizacion = NOW()
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
        await tx.queryObject("DELETE FROM usuario_contactos WHERE usuario_id = $1", [
          id,
        ]);
        for (const cont of contactos) {
          await tx.queryObject(
            "INSERT INTO usuario_contactos (usuario_id, tipo, contenido, principal) VALUES ($1, $2, $3, $4)",
            [id, cont.tipo, cont.contenido, cont.principal ?? false],
          );
        }
      }

      if (maestro?.especialidad !== undefined) {
        await tx.queryObject(
          `INSERT INTO maestros (usuario_id, especialidad, fecha_contratacion, estado)
           VALUES ($1, $2, CURRENT_DATE, 'activo')
           ON CONFLICT (usuario_id) DO UPDATE SET
             especialidad = EXCLUDED.especialidad,
             fecha_actualizacion = NOW()`,
          [id, maestro.especialidad],
        );
      }

      if (Array.isArray(maestro?.materias)) {
        const maestroRes = await tx.queryObject<{ id: bigint; materiasConfiguradas: boolean }>(
          `SELECT id, materias_configuradas AS "materiasConfiguradas"
           FROM maestros WHERE usuario_id = $1 LIMIT 1`,
          [id],
        );
        if (maestroRes.rows[0]) {
          const maestroId = maestroRes.rows[0].id;
          const materiaIds = [...new Set(
            maestro.materias
              .map((value: unknown) => String(value).trim())
              .filter((value: string) => /^\d+$/.test(value)),
          )];
          // Un docente legacy sin catálogo explícito conserva su catálogo
          // vigente si el formulario no selecciona ninguna materia. Sólo una
          // lista no vacía, o un docente ya configurado, autoriza replace.
          if (materiaIds.length > 0 || maestroRes.rows[0].materiasConfiguradas) {
            await tx.queryObject(
              `UPDATE maestros SET materias_configuradas = true, fecha_actualizacion = NOW() WHERE id = $1`,
              [maestroId],
            );
            await tx.queryObject(`DELETE FROM maestro_materias WHERE maestro_id = $1`, [maestroId]);
            if (materiaIds.length) {
              await tx.queryObject(
                `INSERT INTO maestro_materias (maestro_id, materia_id)
                 SELECT $1, v.materia_id::bigint
                 FROM UNNEST($2::bigint[]) AS v(materia_id)
                 ON CONFLICT (maestro_id, materia_id) DO NOTHING`,
                [maestroId, materiaIds],
              );
            }
          }
        }
      }

      if (dynamicData.ocupacion !== undefined) {
        await tx.queryObject(
          `INSERT INTO apoderados (usuario_id, ocupacion)
           VALUES ($1, $2)
           ON CONFLICT (usuario_id) DO UPDATE SET ocupacion = EXCLUDED.ocupacion`,
          [id, dynamicData.ocupacion],
        );
      }

      if (Array.isArray(updatedDocumentos)) {
        for (const doc of updatedDocumentos) {
          if (!doc?.tipoDoc || !doc?.numeroDoc) continue;
          if (doc.id) {
            // El frontend envió el id de fila: actualizar directamente usando ON CONFLICT
            // en numero_doc para evitar duplicados si el número cambia.
            await tx.queryObject(
              `UPDATE usuario_documentos
               SET tipo_doc = $1, numero_doc = $2, doc_url = COALESCE($3, doc_url)
               WHERE id = $4 AND usuario_id = $5`,
              [doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null, doc.id, id],
            );
          } else {
            // Sin id: upsert por (usuario_id, tipo_doc). Si el numero_doc ya pertenece
            // a otra fila del mismo usuario lo actualiza; si pertenece a otro usuario
            // el constraint lo impedirá y el error llegará al catch con código 409.
            await tx.queryObject(
              `INSERT INTO usuario_documentos (usuario_id, tipo_doc, numero_doc, doc_url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (usuario_id, tipo_doc) DO UPDATE
                 SET numero_doc = EXCLUDED.numero_doc,
                     doc_url    = COALESCE(EXCLUDED.doc_url, usuario_documentos.doc_url)`,
              [id, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null],
            );
          }
        }
      }

      // Actualizar datos del tutor/apoderado si se envían para el estudiante
      const tutorData = dynamicData.apoderado ?? dynamicData.tutor;
      const parentescoInput = dynamicData.parentesco;
      if (tutorData || parentescoInput !== undefined) {
        const apodRes = await tx.queryObject<{ estudianteId: bigint; apoderadoId: bigint; usuarioId: bigint }>(
          `SELECT ea.estudiante_id AS "estudianteId", ea.apoderado_id AS "apoderadoId", a.usuario_id AS "usuarioId"
           FROM estudiantes e
           JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
           JOIN apoderados a ON a.id = ea.apoderado_id
           WHERE e.usuario_id = $1
           LIMIT 1`,
          [id],
        );

        if (apodRes.rows.length > 0) {
          const tutorUsuarioId = apodRes.rows[0].usuarioId;
          const estudianteTableId = apodRes.rows[0].estudianteId;
          const apoderadoTableId = apodRes.rows[0].apoderadoId;

          const pFinal = (parentescoInput ?? tutorData?.parentesco)?.trim();
          if (pFinal) {
            await tx.queryObject(
              `UPDATE estudiante_apoderado SET parentesco = $1 WHERE estudiante_id = $2 AND apoderado_id = $3`,
              [pFinal, estudianteTableId, apoderadoTableId],
            );
          }

          if (tutorData) {
            const tNombre = tutorData.nombre?.trim();
            const tPaterno = tutorData.apellidoPaterno?.trim();
            const tMaterno = tutorData.apellidoMaterno?.trim();
            if (tNombre || tPaterno || tMaterno !== undefined) {
              await tx.queryObject(
                `UPDATE usuarios SET
                   nombre = COALESCE($1, nombre),
                   apellido_paterno = COALESCE($2, apellido_paterno),
                   apellido_materno = COALESCE($3, apellido_materno),
                   fecha_actualizacion = NOW()
                 WHERE id = $4`,
                [tNombre ?? null, tPaterno ?? null, tMaterno ?? null, tutorUsuarioId],
              );
            }

            if (tutorData.ci?.trim()) {
              const ciVal = tutorData.ci.trim();
              // Upsert CI del tutor/apoderado
              await tx.queryObject(
                `INSERT INTO usuario_documentos (usuario_id, tipo_doc, numero_doc)
                 VALUES ($1, 'CI', $2)
                 ON CONFLICT (usuario_id, tipo_doc) DO UPDATE
                   SET numero_doc = EXCLUDED.numero_doc`,
                [tutorUsuarioId, ciVal],
              );
            }

            const tCelular = tutorData.celular?.trim() ?? tutorData.telefono?.trim();
            if (tCelular) {
              const telCheck = await tx.queryObject<{ id: bigint }>(
                `SELECT id FROM usuario_contactos WHERE usuario_id = $1 AND (tipo = 'Celular' OR tipo = 'Telefono') LIMIT 1`,
                [tutorUsuarioId],
              );
              if (telCheck.rows.length > 0) {
                await tx.queryObject(
                  `UPDATE usuario_contactos SET contenido = $1 WHERE id = $2`,
                  [tCelular, telCheck.rows[0].id],
                );
              } else {
                await tx.queryObject(
                  `INSERT INTO usuario_contactos (usuario_id, tipo, contenido, principal) VALUES ($1, 'Celular', $2, TRUE)`,
                  [tutorUsuarioId, tCelular],
                );
              }
            }

            const snapshotName = [tutorData?.nombre, tutorData?.apellidoPaterno, tutorData?.apellidoMaterno]
              .filter(Boolean).join(" ").trim() || null;
            const snapshotPhone = tutorData?.celular?.trim() ?? tutorData?.telefono?.trim() ?? null;
            if (snapshotName || snapshotPhone) {
              await tx.queryObject(
                `UPDATE estudiantes
                 SET tutor_nombre = COALESCE($2, tutor_nombre),
                     tutor_telefono = COALESCE($3, tutor_telefono),
                     tutor_parentesco = COALESCE($4, tutor_parentesco),
                     fecha_actualizacion = NOW()
                 WHERE id = $1`,
                [estudianteTableId, snapshotName, snapshotPhone, pFinal ?? null],
              );
            }
          }
        } else {
          const studentRes = await tx.queryObject<{ id: bigint }>(
            `SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`,
            [id],
          );
          const snapshotName = [tutorData?.nombre, tutorData?.apellidoPaterno, tutorData?.apellidoMaterno]
            .filter(Boolean).join(" ").trim() || null;
          const snapshotPhone = tutorData?.celular?.trim() ?? tutorData?.telefono?.trim() ?? null;
          if (studentRes.rows.length && (snapshotName || snapshotPhone)) {
            await tx.queryObject(
              `UPDATE estudiantes
               SET tutor_nombre = COALESCE($2, tutor_nombre),
                   tutor_telefono = COALESCE($3, tutor_telefono),
                   tutor_parentesco = COALESCE($4, tutor_parentesco),
                   fecha_actualizacion = NOW()
               WHERE id = $1`,
              [studentRes.rows[0].id, snapshotName, snapshotPhone, parentescoInput?.trim() ?? tutorData?.parentesco?.trim() ?? null],
            );
          }
        }
      }
    });

    if (isSelf && ["estudiante", "alumno", "padre", "padres", "apoderado", "tutor"].includes(targetRole)) {
      const readiness = await query<{ personal: boolean; tutor: boolean }>(
        `SELECT
          (u.nacimiento IS NOT NULL AND EXISTS (SELECT 1 FROM usuario_direcciones d WHERE d.usuario_id = u.id)
             AND EXISTS (SELECT 1 FROM usuario_contactos c WHERE c.usuario_id = u.id)) AS personal,
          (
            EXISTS (
              SELECT 1 FROM estudiantes e
              JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
              JOIN apoderados a ON a.id = ea.apoderado_id
              WHERE e.usuario_id = u.id
                AND EXISTS (SELECT 1 FROM usuario_contactos tc WHERE tc.usuario_id = a.usuario_id)
            )
            OR EXISTS (
              SELECT 1 FROM estudiantes e
              WHERE e.usuario_id = u.id
                AND e.tutor_nombre IS NOT NULL
                AND e.tutor_telefono IS NOT NULL
            )
            OR NOT EXISTS (SELECT 1 FROM estudiantes e2 WHERE e2.usuario_id = u.id)
          ) AS tutor
         FROM usuarios u WHERE u.id = $1`,
        [id],
      );
      const row = readiness.rows[0];
      onboarding = {
        datosPersonalesActualizados: Boolean(row?.personal),
        contactoTutorActualizado: Boolean(row?.tutor),
      };
      await query(
        `UPDATE usuario_cuenta
         SET datos_personales_actualizados = $2, contacto_tutor_actualizado = $3, fecha_actualizacion = NOW()
         WHERE usuario_id = $1`,
        [id, onboarding.datosPersonalesActualizados, onboarding.contactoTutorActualizado],
      );
    }

    ctx.response.status = 200;
    broadcastUserEvent({ action: "updated", userId: id });
    ctx.response.body = {
      message: "Usuario actualizado correctamente",
      fotoUrl: await resolveMediaUrl(newFotoUrl),
      onboarding,
    };
  } catch (err) {
    // sTransaction wraps PostgresError inside a TransactionError (.cause).
    // Leer el error real tanto del propio err como de err.cause.
    // deno-lint-ignore no-explicit-any
    const cause = (err as any)?.cause as any;
    const msg = [
      (err as Error)?.message ?? "",
      cause?.message ?? "",
    ].join(" ").toLowerCase();
    const constraint = [
      String((err as { constraint?: string })?.constraint ?? ""),
      String(cause?.fields?.constraint ?? ""),
      String(cause?.constraint ?? ""),
    ].join(" ").toLowerCase();

    console.error("[updateUsuario]", err);

    if (msg.includes("unique") || msg.includes("duplicate") || msg.includes("23505") || constraint.trim().length > 0) {
      let field = "general";
      let error = "Ya existe un dato registrado para otro usuario";
      if (constraint.includes("username") || msg.includes("username") || msg.includes("uq_usuario_username")) {
        field = "username";
        error = "El username ya está registrado";
      } else if (constraint.includes("email") || msg.includes("email") || msg.includes("uq_usuario_email")) {
        field = "email";
        error = "El correo electrónico ya está registrado";
      } else if (constraint.includes("numero_doc") || msg.includes("numero_doc") || msg.includes("documentos")) {
        field = "numeroDoc";
        error = "El número de documento ya está registrado para otro usuario";
      }
      ctx.response.status = 409;
      ctx.response.body = { error, message: error, field };
      return;
    }
    ctx.response.status = 500;
    ctx.response.body = { error: "Error interno del servidor" };
  }
}
