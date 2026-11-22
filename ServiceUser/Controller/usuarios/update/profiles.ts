import { query } from "../../../connects/Database/transaction.ts";

export interface TutorUpdateInput {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  ci?: string;
  celular?: string;
  telefono?: string;
  parentesco?: string;
}

export interface DynamicUsuarioUpdate {
  nivel?: string;
  grado?: string;
  estudiante?: { nivel?: string; grado?: string };
  apoderado?: TutorUpdateInput;
  tutor?: TutorUpdateInput;
  parentesco?: string;
  ocupacion?: string;
}

// deno-lint-ignore no-explicit-any
type TxClient = { queryObject: <T = any>(sql: string, args?: unknown[]) => Promise<{ rows: T[] }> };

// usuarios -> sincronizacion de perfiles maestro, apoderado, documentos y tutor
export async function syncUsuarioRoleProfiles(
  tx: TxClient,
  id: string,
  // deno-lint-ignore no-explicit-any
  maestro: any,
  dynamicData: DynamicUsuarioUpdate,
  // deno-lint-ignore no-explicit-any
  updatedDocumentos: any,
): Promise<void> {
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
      `SELECT id, materias_configuradas AS "materiasConfiguradas" FROM maestros WHERE usuario_id = $1 LIMIT 1`,
      [id],
    );
    if (maestroRes.rows[0]) {
      const maestroId = maestroRes.rows[0].id;
      const materiaIds = [...new Set(
        maestro.materias.map((value: unknown) => String(value).trim()).filter((value: string) => /^\d+$/.test(value)),
      )];
      if (materiaIds.length > 0 || maestroRes.rows[0].materiasConfiguradas) {
        await tx.queryObject(
          `UPDATE maestros SET materias_configuradas = true, fecha_actualizacion = NOW() WHERE id = $1`,
          [maestroId],
        );
        await tx.queryObject(`DELETE FROM maestro_materias WHERE maestro_id = $1`, [maestroId]);
        if (materiaIds.length) {
          await tx.queryObject(
            `INSERT INTO maestro_materias (maestro_id, materia_id)
             SELECT $1, v.materia_id::bigint FROM UNNEST($2::bigint[]) AS v(materia_id)
             ON CONFLICT (maestro_id, materia_id) DO NOTHING`,
            [maestroId, materiaIds],
          );
        }
      }
    }
  }

  if (dynamicData.ocupacion !== undefined) {
    await tx.queryObject(
      `INSERT INTO apoderados (usuario_id, ocupacion) VALUES ($1, $2)
       ON CONFLICT (usuario_id) DO UPDATE SET ocupacion = EXCLUDED.ocupacion`,
      [id, dynamicData.ocupacion],
    );
  }

  if (Array.isArray(updatedDocumentos)) {
    for (const doc of updatedDocumentos) {
      if (!doc?.tipoDoc || !doc?.numeroDoc) continue;
      if (doc.id) {
        await tx.queryObject(
          `UPDATE usuario_documentos SET tipo_doc = $1, numero_doc = $2, doc_url = COALESCE($3, doc_url)
           WHERE id = $4 AND usuario_id = $5`,
          [doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null, doc.id, id],
        );
      } else {
        await tx.queryObject(
          `INSERT INTO usuario_documentos (usuario_id, tipo_doc, numero_doc, doc_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (usuario_id, tipo_doc) DO UPDATE
             SET numero_doc = EXCLUDED.numero_doc,
                 doc_url = COALESCE(EXCLUDED.doc_url, usuario_documentos.doc_url)`,
          [id, doc.tipoDoc, doc.numeroDoc, doc.docUrl ?? null],
        );
      }
    }
  }

  await syncTutorEstudiante(tx, id, dynamicData);
}

async function syncTutorEstudiante(tx: TxClient, id: string, dynamicData: DynamicUsuarioUpdate): Promise<void> {
  const tutorData = dynamicData.apoderado ?? dynamicData.tutor;
  const parentescoInput = dynamicData.parentesco;
  if (!tutorData && parentescoInput === undefined) return;

  const apodRes = await tx.queryObject<{ estudianteId: bigint; apoderadoId: bigint; usuarioId: bigint }>(
    `SELECT ea.estudiante_id AS "estudianteId", ea.apoderado_id AS "apoderadoId", a.usuario_id AS "usuarioId"
     FROM estudiantes e
     JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
     JOIN apoderados a ON a.id = ea.apoderado_id
     WHERE e.usuario_id = $1 LIMIT 1`,
    [id],
  );

  const snapshotName = [tutorData?.nombre, tutorData?.apellidoPaterno, tutorData?.apellidoMaterno]
    .filter(Boolean).join(" ").trim() || null;
  const snapshotPhone = tutorData?.celular?.trim() ?? tutorData?.telefono?.trim() ?? null;
  const pFinal = (parentescoInput ?? tutorData?.parentesco)?.trim();

  if (apodRes.rows.length === 0) {
    const studentRes = await tx.queryObject<{ id: bigint }>(`SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`, [id]);
    if (studentRes.rows.length && (snapshotName || snapshotPhone)) {
      await tx.queryObject(
        `UPDATE estudiantes
         SET tutor_nombre = COALESCE($2, tutor_nombre),
             tutor_telefono = COALESCE($3, tutor_telefono),
             tutor_parentesco = COALESCE($4, tutor_parentesco),
             fecha_actualizacion = NOW()
         WHERE id = $1`,
        [studentRes.rows[0].id, snapshotName, snapshotPhone, pFinal ?? null],
      );
    }
    return;
  }

  const { usuarioId: tutorUsuarioId, estudianteId: estudianteTableId, apoderadoId: apoderadoTableId } = apodRes.rows[0];
  if (pFinal) {
    await tx.queryObject(
      `UPDATE estudiante_apoderado SET parentesco = $1 WHERE estudiante_id = $2 AND apoderado_id = $3`,
      [pFinal, estudianteTableId, apoderadoTableId],
    );
  }
  if (!tutorData) return;

  const tNombre = tutorData.nombre?.trim();
  const tPaterno = tutorData.apellidoPaterno?.trim();
  const tMaterno = tutorData.apellidoMaterno?.trim();
  if (tNombre || tPaterno || tMaterno !== undefined) {
    await tx.queryObject(
      `UPDATE usuarios SET nombre = COALESCE($1, nombre), apellido_paterno = COALESCE($2, apellido_paterno),
         apellido_materno = COALESCE($3, apellido_materno), fecha_actualizacion = NOW() WHERE id = $4`,
      [tNombre ?? null, tPaterno ?? null, tMaterno ?? null, tutorUsuarioId],
    );
  }

  if (tutorData.ci?.trim()) {
    await tx.queryObject(
      `INSERT INTO usuario_documentos (usuario_id, tipo_doc, numero_doc) VALUES ($1, 'CI', $2)
       ON CONFLICT (usuario_id, tipo_doc) DO UPDATE SET numero_doc = EXCLUDED.numero_doc`,
      [tutorUsuarioId, tutorData.ci.trim()],
    );
  }

  if (snapshotPhone) {
    const telCheck = await tx.queryObject<{ id: bigint }>(
      `SELECT id FROM usuario_contactos WHERE usuario_id = $1 AND (tipo = 'Celular' OR tipo = 'Telefono') LIMIT 1`,
      [tutorUsuarioId],
    );
    if (telCheck.rows.length > 0) {
      await tx.queryObject(`UPDATE usuario_contactos SET contenido = $1 WHERE id = $2`, [snapshotPhone, telCheck.rows[0].id]);
    } else {
      await tx.queryObject(`INSERT INTO usuario_contactos (usuario_id, tipo, contenido, principal) VALUES ($1, 'Celular', $2, TRUE)`, [tutorUsuarioId, snapshotPhone]);
    }
  }

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

// usuarios -> verificacion de completitud de onboarding estudiantil
export async function syncSelfOnboardingStatus(
  id: string,
): Promise<{ datosPersonalesActualizados: boolean; contactoTutorActualizado: boolean }> {
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
          WHERE e.usuario_id = u.id AND e.tutor_nombre IS NOT NULL AND e.tutor_telefono IS NOT NULL
        )
        OR NOT EXISTS (SELECT 1 FROM estudiantes e2 WHERE e2.usuario_id = u.id)
      ) AS tutor
     FROM usuarios u WHERE u.id = $1`,
    [id],
  );
  const row = readiness.rows[0];
  const onboarding = {
    datosPersonalesActualizados: Boolean(row?.personal),
    contactoTutorActualizado: Boolean(row?.tutor),
  };
  await query(
    `UPDATE usuario_cuenta
     SET datos_personales_actualizados = $2, contacto_tutor_actualizado = $3, fecha_actualizacion = NOW()
     WHERE usuario_id = $1`,
    [id, onboarding.datosPersonalesActualizados, onboarding.contactoTutorActualizado],
  );
  return onboarding;
}
