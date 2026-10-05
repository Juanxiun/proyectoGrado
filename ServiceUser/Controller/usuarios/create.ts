import { Context } from "@oak/oak";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { resolveMediaUrl, uploadFile, uploadImage } from "../../connects/Storage/minio.ts";
import { formFieldAsString, readFilePart, readMultipartForm } from "../../utils/multipart.ts";
import { serialize } from "../../utils/serialize.ts";
import {
  buildDocKey,
  buildPhotoKey,
} from "../../utils/fileNaming.ts";
import bcrypt from "bcryptjs";
import { broadcastUserEvent } from "../../services/websocket.service.ts";
import { generateUsername, generateEmail, generatePassword } from "../../utils/username.ts";
import { sendWelcomeCredentialsEmail } from "../../services/credentialsEmail.service.ts";
import { publicarEventoAsync } from "../../utils/events.ts";
import {
  validatePasswordPolicy,
  validateUsernamePolicy,
} from "../auth/changePassword.ts";

// ruta -> crear usuario multipart
export async function createUsuario(ctx: Context): Promise<void> {
  try {
    const contentType = ctx.request.headers.get("content-type") ?? "";

    // deno-lint-ignore no-explicit-any
    let datos: Record<string, any>;
    let fotoBytes: Uint8Array | null = null;
    let fotoExt: "webp" | null = null;

    const documentFiles: Array<{ index: number; bytes: Uint8Array; name: string }> = [];

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
      if (foto) {
        fotoBytes = foto.bytes;
        fotoExt = "webp";
      }

      if (Array.isArray(datos.documentos)) {
        for (let i = 0; i < datos.documentos.length; i++) {
          const doc = datos.documentos[i];
          const docFile = await readFilePart(form.get("doc_file_" + i) || form.get("doc_file_" + doc.tipoDoc));
          if (docFile) {
            const extension = docFile.name.split(".").pop()?.toLowerCase() ?? "";
            if (!["pdf", "docx", "xlsx", "xls"].includes(extension)) {
              ctx.response.status = 400;
              ctx.response.body = { error: "El documento " + (i + 1) + " debe ser PDF, DOCX, XLSX o XLS" };
              return;
            }
            documentFiles.push({ index: i, bytes: docFile.bytes, name: docFile.name });
          }
        }
      }
    } else {
      datos = await ctx.request.body.json();
    }

    const { rolId, rol: requestedRoleInput, nombre, apellidoPaterno, apellidoMaterno, nacimiento, genero, estado, cuenta, documentos, direccion, contactos, maestro, apoderadoId, parentesco } = datos;

    if ((!rolId && !requestedRoleInput) || !nombre?.trim() || !apellidoPaterno?.trim() || !nacimiento) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Faltan campos obligatorios: rol, nombre, apellidoPaterno, nacimiento" };
      return;
    }

    if (cuenta?.password !== undefined && cuenta.password !== "" && (typeof cuenta.password !== "string" || cuenta.password.length < 8)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "La contrasena debe tener al menos 8 caracteres" };
      return;
    }

    const roleAliases: Record<string, string> = {
      admin: "director",
      administrador: "director",
      maestro: "profesor",
      maestros: "profesor",
      profesores: "profesor",
      docente: "profesor",
      alumno: "estudiante",
      estudiantes: "estudiante",
      directores: "director",
      padre: "apoderado",
      padres: "apoderado",
      tutor: "apoderado",
      secretaria: "control",
      secretario: "control",
      gerencia: "control",
      administrativo: "control",
      editor: "control",
    };
    const requestedRole = String(requestedRoleInput ?? "").trim().toLowerCase();
    const mappedRole = roleAliases[requestedRole] ?? requestedRole;
    const legacyRoleById: Record<string, string> = {
      "1": "director",
      "2": "profesor",
      "3": "estudiante",
      "4": "control",
      "5": "apoderado",
    };
    const roleName = mappedRole || legacyRoleById[String(rolId ?? "")] || "";
    let rolResult = await query<{ id: bigint; rol: string }>(
      `SELECT id, rol FROM roles WHERE LOWER(rol) = $1 AND COALESCE(activo, true) = true LIMIT 1`,
      [roleName],
    );
    if (rolResult.rows.length === 0 && rolId) {
      rolResult = await query<{ id: bigint; rol: string }>(`SELECT id, rol FROM roles WHERE id = $1 AND COALESCE(activo, true) = true`, [rolId]);
    }
    if (rolResult.rows.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: `Rol "${roleName || rolId || ""}" no existe o está inactivo` };
      return;
    }
    const resolvedRolId = rolResult.rows[0].id;
    const rolNombre = rolResult.rows[0].rol.toLowerCase();

    if (ctx.state.auth?.role === "control" && !["profesor", "profesores", "maestro", "maestros", "docente", "estudiante", "estudiantes", "alumno", "alumnos", "control", "administrativo", "secretaria", "editor", "apoderado", "tutor", "gerencia"].includes(rolNombre)) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Control no puede registrar el rol de director" };
      return;
    }

    const ciDoc = Array.isArray(documentos) ? documentos.find((d) => d.tipoDoc === "CI" || d.tipoDoc === "ci") : undefined;
    const ci = ciDoc?.numeroDoc ?? "";

    const apellidoMaternoFinal = apellidoMaterno?.trim() || null;

    const username = String(cuenta?.username ?? "").trim() || generateUsername(nombre, apellidoPaterno, apellidoMaternoFinal ?? "", ci);
    const email = String(cuenta?.email ?? "").trim() || generateEmail(username);
    const password = String(cuenta?.password ?? "") || generatePassword(username);

    const cuentaFinal = {
      username,
      email,
      password,
    };

    let estadoFinal: "activo" | "inactivo" | "bloqueado" = "activo";
    if (estado === 0 || estado === "inactivo") {
      estadoFinal = "inactivo";
    } else if (estado === 2 || estado === "bloqueado") {
      estadoFinal = "bloqueado";
    }

    let fotoUrl: string | null = null;
    if (fotoBytes && fotoExt) {
      const photoKey = buildPhotoKey(nombre, apellidoPaterno, rolNombre, fotoExt);
      fotoUrl = await uploadImage(photoKey, fotoBytes, "image/webp");
    }

    if (cuentaFinal) {
      const usernameCheck = validateUsernamePolicy(cuentaFinal.username);
      if (!usernameCheck.valid) {
        ctx.response.status = 400;
        ctx.response.body = { error: usernameCheck.error, field: "username" };
        return;
      }
    }

    const passwordCheck = validatePasswordPolicy(password);
    if (!passwordCheck.valid) {
      ctx.response.status = 400;
      ctx.response.body = { error: passwordCheck.error, field: "password" };
      return;
    }

    // deno-lint-ignore no-explicit-any
    const passwordHash: string | null = await (bcrypt as any).hash(password, 12);

    const usuarioId = await sTransaction(async (tx) => {
      const usuarioRes = await tx.queryObject<{ id: bigint }>(`
        INSERT INTO usuarios (rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, foto_url, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
      `, [resolvedRolId, nombre.trim(), apellidoPaterno.trim(), apellidoMaternoFinal, nacimiento, genero ?? null, fotoUrl, estadoFinal]);
      const uid = usuarioRes.rows[0].id;

      if (cuentaFinal) {
        await tx.queryObject(
          `INSERT INTO usuario_cuenta
             (usuario_id, username, email, password_hash, primer_login,
              datos_personales_actualizados, contacto_tutor_actualizado, password_actualizado)
           VALUES ($1, $2, $3, $4, true, false, false, false)`,
          [uid, cuentaFinal.username, cuentaFinal.email, passwordHash],
        );
      }

      if (Array.isArray(documentos)) {
        for (let i = 0; i < documentos.length; i++) {
          const doc = documentos[i];
          if (!doc?.tipoDoc || !String(doc.numeroDoc ?? "").trim()) continue;
          const file = documentFiles.find((f) => f.index === i);
          if (file) {
            const nivel = datos.nivel || datos.estudiante?.nivel;
            const grado = datos.grado || datos.estudiante?.grado;
            const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
            const docKey = buildDocKey(nombre, apellidoPaterno, rolNombre, doc.tipoDoc, nivel, grado, extension);
            doc.docUrl = await uploadFile(docKey, file.bytes);
          }
          await tx.queryObject(`INSERT INTO usuario_documentos (usuario_id, tipo_doc, numero_doc, doc_url) VALUES ($1, $2, $3, $4)`,
            [uid, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null]);
        }
      }

      if (direccion) {
        await tx.queryObject(`INSERT INTO usuario_direcciones (usuario_id, zona, distrito, bloque, calle, numero, edificio, piso, referencia) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [uid, direccion.zona, direccion.distrito ?? null, direccion.bloque ?? null, direccion.calle ?? null, direccion.numero ?? null, direccion.edificio ?? null, direccion.piso ?? null, direccion.referencia ?? null]);
      }

      if (Array.isArray(contactos)) {
        for (const cont of contactos) {
          await tx.queryObject(`INSERT INTO usuario_contactos (usuario_id, tipo, contenido, principal) VALUES ($1, $2, $3, $4)`,
            [uid, cont.tipo, cont.contenido, cont.principal ?? false]);
        }
      }

      const hoy = new Date().toISOString().split("T")[0];

      if (["estudiante", "estudiantes", "alumno", "alumnos"].includes(rolNombre)) {
        const estRes = await tx.queryObject<{ id: bigint }>(
          `INSERT INTO estudiantes (usuario_id, fecha_ingreso, estado) VALUES ($1, $2, 'activo') RETURNING id`,
          [uid, hoy]
        );
        const estudianteTableId = estRes.rows[0].id;

        if (apoderadoId !== undefined && apoderadoId !== null && String(apoderadoId).trim() !== "") {
          let apodRow = await tx.queryObject<{ id: bigint }>(
            `SELECT id FROM apoderados WHERE usuario_id = $1`,
            [apoderadoId]
          );
          if (apodRow.rows.length === 0) {
            apodRow = await tx.queryObject<{ id: bigint }>(
              `INSERT INTO apoderados (usuario_id) VALUES ($1) RETURNING id`,
              [apoderadoId]
            );
          }
          const apoderadoTableId = apodRow.rows[0].id;
          await tx.queryObject(
            `INSERT INTO estudiante_apoderado (estudiante_id, apoderado_id, parentesco, es_principal, autorizado_recoger) VALUES ($1, $2, $3, TRUE, TRUE) ON CONFLICT (estudiante_id, apoderado_id) DO NOTHING`,
            [estudianteTableId, apoderadoTableId, parentesco ?? "Tutor Legal"]
          );
        }
      }

      if (["profesor", "profesores", "maestro", "maestros", "docente"].includes(rolNombre)) {
        await tx.queryObject(
          `INSERT INTO maestros (usuario_id, especialidad, fecha_contratacion, estado, materias_configuradas)
           VALUES ($1, $2, $3, 'activo', $4)`,
          [uid, maestro?.especialidad ?? null, maestro?.fechaContratacion ?? hoy, Array.isArray(maestro?.materias)]
        );
        const materiaIds = Array.isArray(maestro?.materias)
          ? [...new Set(maestro.materias.map((value: unknown) => String(value).trim()).filter((value: string) => /^\d+$/.test(value)))]
          : [];
        if (materiaIds.length) {
          await tx.queryObject(
            `INSERT INTO maestro_materias (maestro_id, materia_id)
             SELECT m.id, v.materia_id::bigint
             FROM maestros m
             CROSS JOIN UNNEST($2::bigint[]) AS v(materia_id)
             WHERE m.usuario_id = $1
             ON CONFLICT (maestro_id, materia_id) DO NOTHING`,
            [uid, materiaIds],
          );
        }
      }

      if (["padre", "madre", "padres", "apoderado", "tutor"].includes(rolNombre)) {
        await tx.queryObject(
          `INSERT INTO apoderados (usuario_id, ocupacion) VALUES ($1, $2) ON CONFLICT (usuario_id) DO NOTHING`,
          [uid, datos.ocupacion ?? null]
        );
      }

      return uid;
    });

    if (cuentaFinal) {
      const targetEmail = Array.isArray(contactos)
        ? contactos.find((c: { tipo?: string; contenido?: string }) => c.tipo?.toLowerCase() === "email" || c.tipo?.toLowerCase() === "correo")?.contenido
        : undefined;

      sendWelcomeCredentialsEmail({
        nombre: `${nombre} ${apellidoPaterno}`.trim(),
        username: cuentaFinal.username,
        email: cuentaFinal.email,
        passwordTemporal: password,
        rol: rolNombre,
        targetEmail: targetEmail || cuentaFinal.email,
      }).catch((e) => console.warn("[createUsuario] Error en envío de credenciales:", e));
    }

    ctx.response.status = 201;
    broadcastUserEvent({ action: "created", userId: String(usuarioId) });
    publicarEventoAsync("usuarios.create", {
      usuarioId: String(usuarioId),
      nombre: datos?.nombre,
      apellido: datos?.apellidoPaterno,
      rol: rolNombre,
    });
    ctx.response.body = serialize({
      message: "Usuario creado correctamente",
      id: usuarioId,
      username: cuentaFinal?.username ?? null,
      email: cuentaFinal?.email ?? null,
      primerLogin: true,
      fotoUrl: fotoUrl ? await resolveMediaUrl(fotoUrl) : null,
    });
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    const uploadStatus = (err as { status?: number })?.status;
    const constraint = String((err as { constraint?: string })?.constraint ?? "").toLowerCase();
    console.error("[createUsuario]", err);
    if (uploadStatus && uploadStatus >= 400 && uploadStatus < 500) {
      ctx.response.status = uploadStatus;
      ctx.response.body = { error: msg };
      return;
    }
    if (uploadStatus === 503) {
      ctx.response.status = 503;
      ctx.response.body = { error: msg };
      return;
    }
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate") || constraint.length > 0) {
      let field = "general";
      let error = "Ya existe un registro con esos datos únicos";
      if (constraint.includes("username") || msg.includes("username") || msg.includes("uq_usuario_username")) {
        field = "username";
        error = "El nombre de usuario ya se encuentra registrado";
      } else if (constraint.includes("email") || msg.includes("email") || msg.includes("uq_usuario_email")) {
        field = "email";
        error = "El correo electrónico ya se encuentra registrado";
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
