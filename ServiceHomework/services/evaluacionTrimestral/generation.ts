// deno-lint-ignore-file no-explicit-any
import { pool } from "../../connects/Database/connect.ts";
import { HttpError } from "../../utils/errors.ts";
import { callLlmJson } from "./llm.ts";
import { emitNotification } from "./notifications.ts";
import {
  ensureEvaluacionesTrimestralesTable,
  getContextoEvaluacionTrimestral,
  getEvaluacionTrimestralById,
  mapRow,
} from "./repository.ts";

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
