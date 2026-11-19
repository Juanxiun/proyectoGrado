// deno-lint-ignore-file no-explicit-any
import { pool } from "../connects/Database/connect.ts";
import { getRagRedis, getRedis } from "../connects/Redis/redis.ts";
import {
  deleteMaterialFile,
  readStoredFile,
} from "../connects/Storage/minio.ts";
import { HttpError } from "../utils/errors.ts";

function llmUrl(): string {
  return String(Deno.env.get("LLM_SERVICE_URL") ?? "http://127.0.0.1:8890").replace(/\/$/, "");
}

function llmSecret(): string {
  return Deno.env.get("LLM_WEBHOOK_SECRET") || "shalom-llm-dev";
}

async function callLlmJson(path: string, body: unknown, timeoutMs = 600_000): Promise<any> {
  const res = await fetch(`${llmUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": llmSecret(),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.detail === "string"
      ? data.detail
      : typeof data?.error === "string"
      ? data.error
      : "No se pudo completar la operación solicitada.";
    throw new HttpError(res.status >= 400 && res.status < 600 ? res.status : 502, msg);
  }
  return data;
}

async function fetchExamJobStatus(examId: string): Promise<Record<string, string> | null> {
  // 1. Leer progreso directamente desde Redis RAG (shalom:rag:job:exam-{id})
  try {
    const ragRedis = getRagRedis();
    if (ragRedis) {
      const hash = await ragRedis.hgetall(`shalom:rag:job:exam-${examId}`);
      if (hash && typeof hash === "object" && Object.keys(hash).length > 0) {
        return hash as Record<string, string>;
      }
    }
  } catch {
    /* fallback a HTTP */
  }

  // 2. Fallback HTTP hacia ServiceAcademicLLMs
  try {
    const res = await fetch(`${llmUrl()}/trimester-exams/jobs/exam-${encodeURIComponent(examId)}`, {
      method: "GET",
      headers: {
        "x-webhook-secret": llmSecret(),
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

async function fetchExamFromRag(examId: string, knownKey?: string): Promise<any | null> {
  // 1. Leer directamente desde Redis RAG (shalom:rag:examn:...)
  try {
    const ragRedis = getRagRedis();
    if (ragRedis) {
      const candidateKeys: string[] = [];
      if (knownKey) candidateKeys.push(knownKey);
      const indexedKey = await ragRedis.get(`shalom:rag:examn:by_id:${examId}`);
      if (indexedKey && !candidateKeys.includes(indexedKey)) {
        candidateKeys.push(indexedKey);
      }

      for (const k of candidateKeys) {
        const raw = await ragRedis.get(k);
        if (raw) {
          try {
            return JSON.parse(raw);
          } catch {
            /* continuar */
          }
        }
      }

      // Buscar por patrón shalom:rag:examn:*:*:*:*:{examId}
      let cursor = "0";
      const pattern = `shalom:rag:examn:*:*:*:*:${examId}`;
      for (let i = 0; i < 10; i++) {
        const [nextCursor, keys] = await ragRedis.scan(cursor, "MATCH", pattern, "COUNT", 200);
        if (Array.isArray(keys) && keys.length > 0) {
          const raw = await ragRedis.get(keys[0]);
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              /* continuar */
            }
          }
        }
        cursor = String(nextCursor ?? "0");
        if (cursor === "0") break;
      }
    }
  } catch {
    /* fallback a HTTP */
  }

  // 2. Fallback HTTP hacia ServiceAcademicLLMs
  try {
    const res = await fetch(`${llmUrl()}/trimester-exams/rag/by-id/${encodeURIComponent(examId)}`, {
      method: "GET",
      headers: {
        "x-webhook-secret": llmSecret(),
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

function parseJsonArray(val: unknown): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function reconcileGeneratingRow(row: any): Promise<ReturnType<typeof mapRow>> {
  const examId = String(row.id);
  if (String(row.estado) !== "generando") {
    return mapRow(row, null);
  }

  const job = await fetchExamJobStatus(examId);
  const jobStatus = String(job?.status ?? "").toUpperCase();

  // Si Redis ya tiene el examen completado (por job COMPLETED o por existir ya en shalom:rag:examn:...), sincronizar BD
  const shouldCheckRagExam =
    jobStatus === "COMPLETED" ||
    Boolean(job?.exam_rag_key) ||
    !job;

  if (shouldCheckRagExam) {
    const ragExam = await fetchExamFromRag(examId, job?.exam_rag_key);
    const preguntas = Array.isArray(ragExam?.preguntas) ? ragExam.preguntas : [];
    if (preguntas.length > 0) {
      const syncClient = await pool.connect();
      let updatedNow = false;
      try {
        const upd = await syncClient.queryObject<any>(
          `
          UPDATE evaluaciones_trimestrales
          SET preguntas_json = $2::jsonb,
              estado = 'en_revision',
              error_mensaje = NULL,
              fecha_actualizacion = CURRENT_TIMESTAMP
          WHERE id = $1 AND estado = 'generando'
          RETURNING id
          `,
          [Number(examId), JSON.stringify(preguntas)],
        );
        updatedNow = upd.rows.length > 0;
      } finally {
        syncClient.release();
      }
      if (updatedNow) {
        await emitNotification("evaluacion.trimestral.lista", {
          evaluacionId: Number(examId),
          usuarioId: Number(row.docente_usuario_id),
          teacher_id: Number(row.docente_usuario_id),
          titulo: String(row.titulo ?? ""),
          cantidadPreguntas: preguntas.length,
        });
      }
      return mapRow(
        { ...row, estado: "en_revision", preguntas_json: preguntas, error_mensaje: null },
        job ? { ...job, progress: "100" } : { progress: "100" },
      );
    }
  }

  if (jobStatus === "FAILED") {
    const errMsg = String(job?.error || "No se pudo completar la generación.");
    const errClient = await pool.connect();
    try {
      await errClient.queryArray(
        `
        UPDATE evaluaciones_trimestrales
        SET estado = 'error',
            error_mensaje = $2,
            fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $1 AND estado = 'generando'
        `,
        [Number(examId), errMsg],
      );
    } finally {
      errClient.release();
    }
    return mapRow({ ...row, estado: "error", error_mensaje: errMsg }, job);
  }

  return mapRow(row, job);
}

async function emitNotification(eventType: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const redis = getRedis();
    const canal = Deno.env.get("EVENTOS_CANAL") || "notificaciones:eventos";
    await redis.publish(
      canal,
      JSON.stringify({
        eventType,
        origen: "ServiceHomework",
        payload,
        emittedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn("[EvaluacionTrimestral] No se pudo publicar notificación:", err);
  }
}

let tableReady: Promise<void> | null = null;

export async function ensureEvaluacionesTrimestralesTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      const client = await pool.connect();
      try {
        await client.queryArray(`
          CREATE TABLE IF NOT EXISTS "evaluaciones_trimestrales" (
            "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "asignacion_id" BIGINT NOT NULL,
            "trimestre_id" BIGINT NOT NULL,
            "trimestre_numero" SMALLINT,
            "docente_usuario_id" BIGINT NOT NULL,
            "titulo" VARCHAR(200) NOT NULL,
            "materia_nombre" VARCHAR(150) NOT NULL DEFAULT '',
            "curso_nombre" VARCHAR(150) NOT NULL DEFAULT '',
            "dificultad_sugerida" VARCHAR(20) NOT NULL DEFAULT 'Medio',
            "dificultad_final" VARCHAR(20) NOT NULL DEFAULT 'Medio' CHECK ("dificultad_final" IN ('Alto', 'Medio', 'Moderado')),
            "cantidad_preguntas" SMALLINT NOT NULL CHECK ("cantidad_preguntas" IN (10, 15, 20)),
            "cantidad_teoricas" SMALLINT NOT NULL DEFAULT 5,
            "cantidad_practicas" SMALLINT NOT NULL DEFAULT 5,
            "temas_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "preguntas_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "estado" VARCHAR(30) NOT NULL DEFAULT 'generando' CHECK ("estado" IN ('generando', 'en_revision', 'aprobada', 'error')),
            "error_mensaje" TEXT,
            "archivo_url" TEXT,
            "archivo_key" TEXT,
            "version_pdf" INT NOT NULL DEFAULT 0,
            "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS "idx_eval_trim_asig" ON "evaluaciones_trimestrales" ("asignacion_id");
          CREATE INDEX IF NOT EXISTS "idx_eval_trim_trim" ON "evaluaciones_trimestrales" ("trimestre_id");
          ALTER TABLE "evaluaciones_trimestrales" ADD COLUMN IF NOT EXISTS "trimestre_numero" SMALLINT;
        `);
      } finally {
        client.release();
      }
    })();
  }
  await tableReady;
}

function mapRow(r: any, job?: Record<string, string> | null) {
  const id = String(r.id);
  const estado = String(r.estado);
  const progresoRaw = job?.progress != null ? Number(job.progress) : undefined;
  const trimNum = r.trimestre_numero_resuelto ?? r.trimestre_numero;
  return {
    id,
    jobId: `exam-${id}`,
    asignacionId: String(r.asignacion_id),
    trimestreId: String(r.trimestre_id),
    trimestreNumero: trimNum != null ? Number(trimNum) : undefined,
    docenteUsuarioId: String(r.docente_usuario_id),
    titulo: String(r.titulo ?? ""),
    materiaNombre: String(r.materia_nombre ?? ""),
    cursoNombre: String(r.curso_nombre ?? ""),
    dificultadSugerida: String(r.dificultad_sugerida ?? "Medio"),
    dificultadFinal: String(r.dificultad_final ?? "Medio") as "Alto" | "Medio" | "Moderado",
    cantidadPreguntas: Number(r.cantidad_preguntas),
    cantidadTeoricas: Number(r.cantidad_teoricas),
    cantidadPracticas: Number(r.cantidad_practicas),
    temas: parseJsonArray(r.temas_json),
    preguntas: parseJsonArray(r.preguntas_json),
    estado,
    errorMensaje: r.error_mensaje ?? null,
    progreso: Number.isFinite(progresoRaw) ? progresoRaw : estado === "generando" ? 5 : 100,
    estadoDetalle: job?.stage || (estado === "generando" ? "Generando preguntas en segundo plano…" : null),
    loteActual: job?.current_batch != null ? Number(job.current_batch) : undefined,
    totalLotes: job?.total_batches != null ? Number(job.total_batches) : undefined,
    preguntasGeneradas: job?.generated_questions != null ? Number(job.generated_questions) : undefined,
    ragKey: job?.exam_rag_key || null,
    tienePdf: Boolean(r.archivo_key || r.archivo_url),
    versionPdf: Number(r.version_pdf ?? 0),
    fechaCreacion: r.fecha_creacion,
    fechaActualizacion: r.fecha_actualizacion,
  };
}

export async function getContextoEvaluacionTrimestral(asignacionId: number) {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    // 1. Validar trimestre vigente (por fecha actual en periodo activo)
    const trimRes = await client.queryObject<any>(`
      SELECT t.id, t.numero, t.inicio, t.fin, p.nombre AS periodo_nombre
      FROM trimestres t
      JOIN periodos_academicos p ON p.id = t.periodo_id
      WHERE CURRENT_DATE BETWEEN t.inicio AND t.fin
      ORDER BY p.activo DESC, t.inicio DESC
      LIMIT 1
    `);
    const trimRow = trimRes.rows[0] ?? null;
    const trimestreVigente = trimRow
      ? {
          id: String(trimRow.id),
          numero: Number(trimRow.numero),
          inicio: trimRow.inicio,
          fin: trimRow.fin,
          periodoNombre: String(trimRow.periodo_nombre ?? ""),
        }
      : null;

    // 2. Datos de la asignación (materia, curso, nivel, periodo)
    const asigRes = await client.queryObject<any>(
      `
      SELECT
        ad.id,
        ad.materia_id,
        cp.periodo_id,
        m.nombre AS materia_nombre,
        c.grado,
        c.paralelo,
        c.nivel
      FROM asignaciones_docentes ad
      JOIN materias m ON m.id = ad.materia_id
      JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
      JOIN cursos c ON c.id = cp.curso_id
      WHERE ad.id = $1
      LIMIT 1
      `,
      [asignacionId],
    );
    const asig = asigRes.rows[0];
    if (!asig) {
      throw new HttpError(404, "La asignación docente indicada no existe.");
    }

    // 2b. Trimestres disponibles del periodo de la asignación (o del periodo activo/más reciente)
    let trimDispRes = await client.queryObject<any>(
      `
      SELECT t.id, t.numero, t.inicio, t.fin, p.nombre AS periodo_nombre
      FROM trimestres t
      JOIN periodos_academicos p ON p.id = t.periodo_id
      WHERE t.periodo_id = $1
      ORDER BY t.numero ASC
      `,
      [asig.periodo_id],
    );
    if (trimDispRes.rows.length === 0) {
      trimDispRes = await client.queryObject<any>(
        `
        SELECT t.id, t.numero, t.inicio, t.fin, p.nombre AS periodo_nombre
        FROM trimestres t
        JOIN periodos_academicos p ON p.id = t.periodo_id
        WHERE p.id = (
          SELECT id FROM periodos_academicos
          ORDER BY activo DESC, anio DESC, id DESC
          LIMIT 1
        )
        ORDER BY t.numero ASC
        `,
      );
    }
    const trimestresDisponibles = trimDispRes.rows.map((r) => ({
      id: String(r.id),
      numero: Number(r.numero),
      inicio: r.inicio,
      fin: r.fin,
      periodoNombre: String(r.periodo_nombre ?? ""),
    }));

    // 3a. Módulos / temas de avance de la malla curricular para esta materia y grado
    const mallaRes = await client.queryObject<any>(
      `
      SELECT id, unidad, titulo, contenidos, horas_previstas, es_evaluacion, orden
      FROM malla_temas
      WHERE LOWER(nivel) = LOWER($1)
        AND grado = $2
        AND materia_id = $3
      ORDER BY orden ASC, unidad ASC, id ASC
      `,
      [String(asig.nivel ?? ""), String(asig.grado ?? ""), asig.materia_id],
    );

    // 3b. Materiales cargados por el docente para esta asignación
    const matRes = await client.queryObject<any>(
      `
      SELECT
        mm.id AS material_id,
        mm.titulo AS material_titulo,
        mm.detalle AS material_detalle,
        mm.tipo_material,
        mm.nombre_archivo,
        mm.tema_id,
        mt.unidad AS tema_unidad,
        mt.titulo AS tema_nombre,
        mm.fecha_subida
      FROM materia_materiales mm
      LEFT JOIN malla_temas mt ON mt.id = mm.tema_id
      WHERE mm.asignacion_id = $1
        AND mm.activo = true
      ORDER BY mm.fecha_subida DESC
      LIMIT 60
      `,
      [asignacionId],
    );

    const rawTemas = matRes.rows.map((row) => ({
      material_id: String(row.material_id),
      titulo: String(row.material_titulo ?? row.tema_nombre ?? "Material"),
      tema_nombre: String(row.tema_nombre ?? row.material_titulo ?? ""),
      tema_id: row.tema_id != null ? String(row.tema_id) : null,
      tema_unidad: row.tema_unidad != null ? Number(row.tema_unidad) : null,
      tipo_material: row.tipo_material ? String(row.tipo_material) : null,
      nombre_archivo: row.nombre_archivo ? String(row.nombre_archivo) : null,
      detalle: String(row.material_detalle ?? ""),
    }));

    let temasRag: any[] = rawTemas.map((t) => ({
      materialId: t.material_id,
      titulo: t.titulo,
      temaNombre: t.tema_nombre,
      temaId: t.tema_id,
      temaUnidad: t.tema_unidad,
      tipoMaterial: t.tipo_material,
      nombreArchivo: t.nombre_archivo,
      detalle: t.detalle,
      ragDisponible: false,
      resumen: t.detalle,
      conceptosClave: [],
    }));

    if (rawTemas.length > 0) {
      try {
        const ragResp = await callLlmJson(
          "/trimester-exams/rag-topics",
          {
            temas: rawTemas.map((t) => ({
              material_id: t.material_id,
              titulo: t.titulo,
              tema_nombre: t.tema_nombre,
            })),
          },
          20_000,
        );
        const byId = new Map<string, any>(
          (ragResp?.temas ?? []).map((x: any) => [String(x.material_id), x]),
        );
        temasRag = rawTemas.map((t) => {
          const info = byId.get(t.material_id);
          return {
            materialId: t.material_id,
            titulo: info?.titulo_rag || t.titulo,
            temaNombre: t.tema_nombre || t.titulo,
            temaId: t.tema_id,
            temaUnidad: t.tema_unidad,
            tipoMaterial: t.tipo_material,
            nombreArchivo: t.nombre_archivo,
            detalle: t.detalle,
            ragDisponible: Boolean(info?.rag_disponible),
            resumen: String(info?.resumen || t.detalle || ""),
            conceptosClave: Array.isArray(info?.conceptos_clave) ? info.conceptos_clave : [],
          };
        });
      } catch (err) {
        console.warn("[EvaluacionTrimestral] No se pudo consultar índice RAG:", err);
      }
    }

    const modulos = mallaRes.rows.map((m) => {
      const modId = String(m.id);
      return {
        id: modId,
        unidad: Number(m.unidad ?? 1),
        titulo: String(m.titulo ?? `Unidad ${m.unidad ?? 1}`),
        contenidos: String(m.contenidos ?? ""),
        horasPrevistas: Number(m.horas_previstas ?? 1),
        esEvaluacion: Boolean(m.es_evaluacion),
        materiales: temasRag.filter((t) => t.temaId === modId),
      };
    });
    const moduloIdSet = new Set(modulos.map((m) => m.id));
    const materialesSinModulo = temasRag.filter((t) => !t.temaId || !moduloIdSet.has(t.temaId));

    // 4. Calcular nivel de dificultad sugerido basado en rendimiento del curso
    const perfRes = await client.queryObject<any>(
      `
      SELECT
        AVG(cal.nota)::float AS promedio_notas,
        COUNT(cal.id)::int AS total_notas
      FROM calificaciones cal
      JOIN encargos e ON e.id = cal.encargo_id
      WHERE e.asignacion_id = $1
      `,
      [asignacionId],
    );
    const asisRes = await client.queryObject<any>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado IN ('presente', 'tarde'))::int AS presentes
      FROM asistencia
      WHERE asignacion_id = $1
      `,
      [asignacionId],
    );

    const promedioNotas = perfRes.rows[0]?.promedio_notas != null
      ? Math.round(Number(perfRes.rows[0].promedio_notas) * 10) / 10
      : null;
    const totalNotas = Number(perfRes.rows[0]?.total_notas ?? 0);
    const totalAsis = Number(asisRes.rows[0]?.total ?? 0);
    const presentes = Number(asisRes.rows[0]?.presentes ?? 0);
    const asistenciaPromedio = totalAsis > 0 ? Math.round((presentes / totalAsis) * 100) : null;

    let dificultadSugerida: "Alto" | "Medio" | "Moderado" = "Medio";
    let justificacion = "El curso mantiene un ritmo equilibrado; se sugiere un nivel Medio.";

    if (promedioNotas !== null && totalNotas >= 3) {
      if (promedioNotas >= 80 && (asistenciaPromedio === null || asistenciaPromedio >= 80)) {
        dificultadSugerida = "Alto";
        justificacion = `Promedio del curso ${promedioNotas}/100 con buen dominio; se sugiere nivel Alto para potenciar el reto académico.`;
      } else if (promedioNotas < 62) {
        dificultadSugerida = "Moderado";
        justificacion = `Promedio del curso ${promedioNotas}/100; se sugiere nivel Moderado para consolidar fundamentos clave.`;
      } else {
        dificultadSugerida = "Medio";
        justificacion = `Promedio del curso ${promedioNotas}/100; se sugiere nivel Medio equilibrado.`;
      }
    } else {
      dificultadSugerida = "Moderado";
      justificacion = "Aún hay pocas calificaciones registradas en el curso; se sugiere iniciar con nivel Moderado.";
    }

    return {
      trimestreVigente,
      trimestresDisponibles,
      asignacion: {
        id: String(asig.id),
        materiaNombre: String(asig.materia_nombre ?? "Materia"),
        cursoNombre: `${asig.grado ?? ""}° ${asig.paralelo ?? ""} (${asig.nivel ?? ""})`.trim(),
        grado: String(asig.grado ?? ""),
        nivel: String(asig.nivel ?? "Secundaria"),
      },
      temas: temasRag,
      modulos,
      materialesSinModulo,
      sugerenciaDificultad: {
        nivel: dificultadSugerida,
        promedioCurso: promedioNotas,
        asistenciaPromedio,
        justificacion,
      },
    };
  } finally {
    client.release();
  }
}

export async function listEvaluacionesTrimestrales(asignacionId?: number) {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const query = asignacionId
      ? `
        SELECT et.*, COALESCE(et.trimestre_numero, t.numero, 1) AS trimestre_numero_resuelto
        FROM evaluaciones_trimestrales et
        LEFT JOIN trimestres t ON t.id = et.trimestre_id
        WHERE et.asignacion_id = $1
        ORDER BY et.fecha_creacion DESC
        LIMIT 100
      `
      : `
        SELECT et.*, COALESCE(et.trimestre_numero, t.numero, 1) AS trimestre_numero_resuelto
        FROM evaluaciones_trimestrales et
        LEFT JOIN trimestres t ON t.id = et.trimestre_id
        ORDER BY et.fecha_creacion DESC
        LIMIT 100
      `;
    const res = asignacionId
      ? await client.queryObject<any>(query, [asignacionId])
      : await client.queryObject<any>(query);
    return await Promise.all(res.rows.map((row) => reconcileGeneratingRow(row)));
  } finally {
    client.release();
  }
}

export async function getEvaluacionTrimestralById(id: number) {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const res = await client.queryObject<any>(
      `
      SELECT et.*, COALESCE(et.trimestre_numero, t.numero, 1) AS trimestre_numero_resuelto
      FROM evaluaciones_trimestrales et
      LEFT JOIN trimestres t ON t.id = et.trimestre_id
      WHERE et.id = $1
      LIMIT 1
      `,
      [id],
    );
    if (!res.rows[0]) {
      throw new HttpError(404, "Evaluación trimestral no encontrada.");
    }
    return await reconcileGeneratingRow(res.rows[0]);
  } finally {
    client.release();
  }
}

export async function iniciarGeneracionTrimestral(
  body: Record<string, any>,
  usuarioId: number,
) {
  await ensureEvaluacionesTrimestralesTable();
  const asignacionId = Number(body.asignacionId);
  if (!Number.isInteger(asignacionId) || asignacionId <= 0) {
    throw new HttpError(400, "Debe seleccionar una materia/asignación válida.");
  }

  const cantidadPreguntas = Number(body.cantidadPreguntas);
  if (![10, 15, 20].includes(cantidadPreguntas)) {
    throw new HttpError(400, "La cantidad total de preguntas debe ser 10, 15 o 20.");
  }

  const cantidadTeoricas = Number(body.cantidadTeoricas);
  const cantidadPracticas = Number(body.cantidadPracticas);
  if (
    !Number.isInteger(cantidadTeoricas) ||
    !Number.isInteger(cantidadPracticas) ||
    cantidadTeoricas < 0 ||
    cantidadPracticas < 0 ||
    cantidadTeoricas + cantidadPracticas !== cantidadPreguntas
  ) {
    throw new HttpError(400, "La distribución teórica y práctica debe sumar el total de preguntas.");
  }

  const dificultadFinal = String(body.dificultadFinal ?? "Medio");
  if (!["Alto", "Medio", "Moderado"].includes(dificultadFinal)) {
    throw new HttpError(400, "La dificultad debe ser Alto, Medio o Moderado.");
  }
  const dificultadSugerida = String(body.dificultadSugerida ?? dificultadFinal);

  const temas = Array.isArray(body.temas) ? body.temas : [];
  if (temas.length === 0) {
    throw new HttpError(400, "Debe seleccionar al menos un tema para generar la evaluación.");
  }

  const contexto = await getContextoEvaluacionTrimestral(asignacionId);

  const requestedTrimestreId = body.trimestreId != null ? String(body.trimestreId).trim() : "";
  const requestedTrimestreNumero = body.trimestreNumero != null ? Number(body.trimestreNumero) : null;
  if (
    requestedTrimestreNumero !== null &&
    (!Number.isInteger(requestedTrimestreNumero) || ![1, 2, 3].includes(requestedTrimestreNumero))
  ) {
    throw new HttpError(400, "El trimestre seleccionado debe ser 1, 2 o 3.");
  }

  let trimestreSeleccionado: { id: number; numero: number } | null = null;

  if (requestedTrimestreId) {
    const matchById = (contexto.trimestresDisponibles ?? []).find(
      (t) => String(t.id) === requestedTrimestreId,
    );
    if (matchById) {
      trimestreSeleccionado = { id: Number(matchById.id), numero: Number(matchById.numero) };
    }
  }

  if (!trimestreSeleccionado && requestedTrimestreNumero !== null) {
    const matchByNum = (contexto.trimestresDisponibles ?? []).find(
      (t) => Number(t.numero) === requestedTrimestreNumero,
    );
    trimestreSeleccionado = matchByNum
      ? { id: Number(matchByNum.id), numero: Number(matchByNum.numero) }
      : { id: requestedTrimestreNumero, numero: requestedTrimestreNumero };
  }

  if (!trimestreSeleccionado && contexto.trimestreVigente) {
    trimestreSeleccionado = {
      id: Number(contexto.trimestreVigente.id),
      numero: Number(contexto.trimestreVigente.numero),
    };
  }

  if (!trimestreSeleccionado) {
    const firstAvailable = contexto.trimestresDisponibles?.[0];
    trimestreSeleccionado = firstAvailable
      ? { id: Number(firstAvailable.id), numero: Number(firstAvailable.numero) }
      : { id: 1, numero: 1 };
  }

  const titulo = String(body.titulo ?? "").trim() ||
    `Evaluación Trimestral T${trimestreSeleccionado.numero} - ${contexto.asignacion.materiaNombre}`;

  const client = await pool.connect();
  let examId = 0;
  let createdRow: any = null;
  try {
    const ins = await client.queryObject<any>(
      `
      INSERT INTO evaluaciones_trimestrales (
        asignacion_id, trimestre_id, trimestre_numero, docente_usuario_id, titulo,
        materia_nombre, curso_nombre, dificultad_sugerida, dificultad_final,
        cantidad_preguntas, cantidad_teoricas, cantidad_practicas,
        temas_json, preguntas_json, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, '[]'::jsonb, 'generando')
      RETURNING *
      `,
      [
        asignacionId,
        trimestreSeleccionado.id,
        trimestreSeleccionado.numero,
        usuarioId,
        titulo,
        contexto.asignacion.materiaNombre,
        contexto.asignacion.cursoNombre,
        dificultadSugerida,
        dificultadFinal,
        cantidadPreguntas,
        cantidadTeoricas,
        cantidadPracticas,
        JSON.stringify(temas),
      ],
    );
    createdRow = { ...ins.rows[0], trimestre_numero: trimestreSeleccionado.numero };
    examId = Number(ins.rows[0].id);
  } finally {
    client.release();
  }

  const llmPayload = {
    exam_id: String(examId),
    titulo,
    materia: contexto.asignacion.materiaNombre,
    curso: contexto.asignacion.cursoNombre,
    grado: contexto.asignacion.grado,
    nivel: contexto.asignacion.nivel,
    trimestre_numero: trimestreSeleccionado.numero,
    dificultad: dificultadFinal,
    cantidad_preguntas: cantidadPreguntas,
    cantidad_teoricas: cantidadTeoricas,
    cantidad_practicas: cantidadPracticas,
    temas: temas.map((t: any) => ({
      material_id: String(t.materialId ?? t.material_id ?? ""),
      titulo: String(t.titulo ?? ""),
      tema_nombre: String(t.temaNombre ?? t.tema_nombre ?? t.titulo ?? ""),
    })),
  };

  // Ejecución asíncrona desacoplada en ServiceAcademicLLMs (no depende de mantener abierta la conexión HTTP)
  let asyncDispatched = false;
  try {
    await callLlmJson("/trimester-exams/generate-async", llmPayload, 15_000);
    asyncDispatched = true;
  } catch (err: any) {
    if (err instanceof HttpError && err.status === 404) {
      asyncDispatched = false;
    } else {
      console.warn(`[EvaluacionTrimestral] Error despachando generate-async para ${examId}, usando fallback:`, err);
      asyncDispatched = false;
    }
  }

  if (asyncDispatched) {
    // Observador ligero en segundo plano para actualizar BD y emitir notificación apenas termine el job en RAG
    (async () => {
      const deadline = Date.now() + 900_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 4_000));
        try {
          const synced = await getEvaluacionTrimestralById(examId);
          if (synced.estado !== "generando") {
            return;
          }
        } catch {
          /* reintentar hasta el deadline */
        }
      }
    })();
  } else {
    (async () => {
      try {
        const llmRes = await callLlmJson("/trimester-exams/generate", llmPayload, 900_000);
        const preguntas = Array.isArray(llmRes?.preguntas) ? llmRes.preguntas : [];
        const bgClient = await pool.connect();
        try {
          await bgClient.queryArray(
            `
            UPDATE evaluaciones_trimestrales
            SET preguntas_json = $2::jsonb,
                estado = 'en_revision',
                error_mensaje = NULL,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = $1 AND estado = 'generando'
            `,
            [examId, JSON.stringify(preguntas)],
          );
        } finally {
          bgClient.release();
        }

        await emitNotification("evaluacion.trimestral.lista", {
          evaluacionId: examId,
          usuarioId,
          teacher_id: usuarioId,
          titulo,
          cantidadPreguntas: preguntas.length,
        });
      } catch (err: any) {
        console.error(`[EvaluacionTrimestral] Error generando examen ${examId}:`, err);
        const errClient = await pool.connect();
        try {
          await errClient.queryArray(
            `
            UPDATE evaluaciones_trimestrales
            SET estado = 'error',
                error_mensaje = $2,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = $1 AND estado = 'generando'
            `,
            [examId, String(err?.message ?? "No se pudo completar la generación.")],
          );
        } finally {
          errClient.release();
        }
      }
    })();
  }

  return mapRow(createdRow);
}

export async function actualizarPreguntaEstado(
  examId: number,
  preguntaId: string,
  estado: "aprobada" | "rechazada" | "pendiente",
  comentario?: string,
) {
  const exam = await getEvaluacionTrimestralById(examId);
  let found = false;
  const updatedPreguntas = exam.preguntas.map((q: any) => {
    if (String(q.id) === String(preguntaId)) {
      found = true;
      return {
        ...q,
        estado,
        comentario: comentario !== undefined ? comentario : (q.comentario ?? ""),
      };
    }
    return q;
  });

  if (!found) {
    throw new HttpError(404, "La pregunta indicada no pertenece a esta evaluación.");
  }

  const client = await pool.connect();
  try {
    await client.queryArray(
      `
      UPDATE evaluaciones_trimestrales
      SET preguntas_json = $2::jsonb,
          estado = CASE WHEN estado = 'aprobada' THEN 'en_revision' ELSE estado END,
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [examId, JSON.stringify(updatedPreguntas)],
    );
  } finally {
    client.release();
  }

  return getEvaluacionTrimestralById(examId);
}

export async function regenerarPreguntaUnica(
  examId: number,
  preguntaId: string,
  indicaciones: string,
) {
  if (!indicaciones || indicaciones.trim().length < 3) {
    throw new HttpError(400, "Escriba las indicaciones específicas para regenerar la pregunta.");
  }

  const exam = await getEvaluacionTrimestralById(examId);
  const target = exam.preguntas.find((q: any) => String(q.id) === String(preguntaId));
  if (!target) {
    throw new HttpError(404, "La pregunta indicada no pertenece a esta evaluación.");
  }

  const llmRes = await callLlmJson(
    "/trimester-exams/regenerate-question",
    {
      materia: exam.materiaNombre,
      curso: exam.cursoNombre,
      nivel: "Secundaria",
      dificultad: exam.dificultadFinal,
      pregunta_actual: target,
      indicaciones_docente: indicaciones.trim(),
      temas: exam.temas.map((t: any) => ({
        material_id: String(t.materialId ?? t.material_id ?? ""),
        titulo: String(t.titulo ?? ""),
        tema_nombre: String(t.temaNombre ?? t.tema_nombre ?? t.titulo ?? ""),
      })),
    },
    300_000,
  );

  const nuevaPregunta = {
    ...llmRes.pregunta,
    id: String(target.id),
    numero: Number(target.numero),
    estado: "pendiente",
    comentario: "",
  };

  // Actualizar ÚNICAMENTE esa pregunta manteniendo intacto el estado de las demás
  const updatedPreguntas = exam.preguntas.map((q: any) =>
    String(q.id) === String(preguntaId) ? nuevaPregunta : q
  );

  const client = await pool.connect();
  try {
    await client.queryArray(
      `
      UPDATE evaluaciones_trimestrales
      SET preguntas_json = $2::jsonb,
          estado = 'en_revision',
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [examId, JSON.stringify(updatedPreguntas)],
    );
  } finally {
    client.release();
  }

  return {
    pregunta: nuevaPregunta,
    evaluacion: await getEvaluacionTrimestralById(examId),
  };
}

export async function aprobarEvaluacionTrimestral(examId: number) {
  const exam = await getEvaluacionTrimestralById(examId);
  if (!exam.preguntas.length) {
    throw new HttpError(400, "La evaluación no contiene preguntas.");
  }

  const pendientes = exam.preguntas.filter((q: any) => q.estado !== "aprobada");
  if (pendientes.length > 0) {
    throw new HttpError(
      400,
      `Debe aprobar todas las preguntas antes de generar el PDF (faltan ${pendientes.length}).`,
    );
  }

  const client = await pool.connect();
  let oldKey: string | null = null;
  const nextVersion = (exam.versionPdf || 0) + 1;
  try {
    const prevRes = await client.queryObject<any>(
      `SELECT archivo_key FROM evaluaciones_trimestrales WHERE id = $1`,
      [examId],
    );
    oldKey = prevRes.rows[0]?.archivo_key ?? null;

    await client.queryArray(
      `
      UPDATE evaluaciones_trimestrales
      SET estado = 'aprobada',
          archivo_url = NULL,
          archivo_key = NULL,
          version_pdf = $2,
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [examId, nextVersion],
    );
  } finally {
    client.release();
  }

  if (oldKey) {
    try {
      await deleteMaterialFile(oldKey);
    } catch (error) {
      console.warn("[EvaluacionTrimestral] No se pudo eliminar el PDF anterior:", error);
    }
  }

  return getEvaluacionTrimestralById(examId);
}

export async function obtenerPdfEvaluacionTrimestral(examId: number): Promise<{ bytes: Uint8Array; fileName: string }> {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const res = await client.queryObject<any>(
      `SELECT archivo_key, archivo_url, titulo, version_pdf FROM evaluaciones_trimestrales WHERE id = $1 LIMIT 1`,
      [examId],
    );
    const row = res.rows[0];
    if (!row || (!row.archivo_key && !row.archivo_url)) {
      throw new HttpError(404, "El PDF de esta evaluación trimestral aún no ha sido generado.");
    }
    const bytes = await readStoredFile(row.archivo_key || row.archivo_url);
    const safeTitle = String(row.titulo ?? `evaluacion_trimestral_${examId}`)
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 60);
    return {
      bytes,
      fileName: `${safeTitle}_v${row.version_pdf || 1}.pdf`,
    };
  } finally {
    client.release();
  }
}

export async function eliminarEvaluacionTrimestral(examId: number): Promise<void> {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const res = await client.queryObject<any>(
      `DELETE FROM evaluaciones_trimestrales WHERE id = $1 RETURNING archivo_key`,
      [examId],
    );
    if (!res.rows[0]) {
      throw new HttpError(404, "Evaluación trimestral no encontrada.");
    }
    if (res.rows[0].archivo_key) {
      await deleteMaterialFile(res.rows[0].archivo_key);
    }
  } finally {
    client.release();
  }
}
