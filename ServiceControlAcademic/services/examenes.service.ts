import { query, sTransaction } from "../connects/Database/transaction.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { publicarEventoControl, publicarEventoConfig } from "../utils/events.ts";
import {
  ExamenParcial,
  PreguntaExamen,
  CreateExamenInput,
  RespuestaExamenEstudiante,
  ExamenRowDB,
  PreguntaRowDB,
  RespuestaRowDB,
} from "../models/control-academico.ts";

interface ExamenRowDB {
  id: bigint;
  materiaId: bigint;
  asignacionId: bigint;
  cursoPeriodoId: bigint;
  trimestre: number;
  titulo: string;
  descripcion: string | null;
  fechaExamen: Date | string;
  horaInicio: string;
  horaFin: string;
  pesoTotal: number;
  estado: string;
  fechaCreacion: Date | string;
  fechaActualizacion: Date | string;
  materiaNombre?: string;
  cursoNombre?: string;
}

interface PreguntaRowDB {
  id: bigint;
  examenId: bigint;
  enunciado: string;
  tipo: string;
  opciones: string[] | null;
  respuestaCorrecta: string | string[] | null;
  puntaje: number;
  orden: number;
  temaId: bigint | null;
}

interface RespuestaRowDB {
  id: bigint;
  examenId: bigint;
  estudianteId: bigint;
  preguntaId: bigint;
  respuesta: string | string[];
  correcta: boolean;
  puntajeObtenido: number;
  tiempoRespuestaMs: number | null;
  fechaRespuesta: Date | string;
  usuarioId: bigint | null;
  nombre: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
}

async function mapExamen(row: ExamenRowDB): Promise<any> {
  return serialize({
    id: toId(row.id),
    materiaId: toId(row.materiaId),
    asignacionId: toId(row.asignacionId),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    trimestre: Number(row.trimestre),
    titulo: row.titulo,
    descripcion: row.descripcion,
    fechaExamen: asDateString(row.fechaExamen),
    horaInicio: row.horaInicio,
    horaFin: row.horaFin,
    pesoTotal: Number(row.pesoTotal),
    estado: row.estado,
    fechaCreacion: asDateTimeString(row.fechaCreacion),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
    materiaNombre: row.materiaNombre,
    cursoNombre: row.cursoNombre,
  });
}

async function mapPregunta(row: PreguntaRowDB): Promise<PreguntaExamen> {
  return {
    id: toId(row.id),
    examenId: toId(row.examenId),
    enunciado: row.enunciado,
    tipo: row.tipo as any,
    opciones: row.opciones,
    respuestaCorrecta: row.respuestaCorrecta,
    puntaje: Number(row.puntaje),
    orden: Number(row.orden),
    temaId: row.temaId ? toId(row.temaId) : undefined,
  };
}

const SELECT_EXAMEN = `
  SELECT
    e.id, e.materia_id AS "materiaId", e.asignacion_id AS "asignacionId",
    e.curso_periodo_id AS "cursoPeriodoId", e.trimestre, e.titulo, e.descripcion,
    e.fecha_examen AS "fechaExamen", e.hora_inicio AS "horaInicio", e.hora_fin AS "horaFin",
    e.peso_total AS "pesoTotal", e.estado, e.fecha_creacion AS "fechaCreacion",
    e.fecha_actualizacion AS "fechaActualizacion",
    m.nombre AS "materiaNombre",
    c.grado || ' grado "' || c.paralelo || '" ' || c.nivel AS "cursoNombre"
  FROM examenes_parciales e
  JOIN materias m ON m.id = e.materia_id
  JOIN cursos_periodo cp ON cp.id = e.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
`;

export async function listExamenes(
  pagination: { page: number; limit: number; offset: number },
  filters: { materiaId?: string; asignacionId?: string; cursoPeriodoId?: string; trimestre?: number; estado?: string },
): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.materiaId) { if (!/^\d+$/.test(filters.materiaId)) throw new HttpError(400, "materiaId numérico"); conditions.push(`e.materia_id = $${idx++}`); params.push(filters.materiaId); }
  if (filters.asignacionId) { if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId numérico"); conditions.push(`e.asignacion_id = $${idx++}`); params.push(filters.asignacionId); }
  if (filters.cursoPeriodoId) { if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId numérico"); conditions.push(`e.curso_periodo_id = $${idx++}`); params.push(filters.cursoPeriodoId); }
  if (filters.trimestre) { if (![1,2,3].includes(Number(filters.trimestre))) throw new HttpError(400, "trimestre 1-3"); conditions.push(`e.trimestre = $${idx++}`); params.push(Number(filters.trimestre)); }
  if (filters.estado) { conditions.push(`e.estado = $${idx++}`); params.push(filters.estado); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<any>(`${SELECT_EXAMEN} ${where} ORDER BY e.fecha_examen DESC LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      query<{ total: string }>(`SELECT COUNT(*) AS total FROM examenes_parciales e ${where}`, params),
    ]);
    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data: await Promise.all(dataRes.rows.map(mapExamen)), total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit) || 0 };
  } catch (err) {
    throw mapDbError(err, "Error al listar examenes");
  }
}

export async function getExamenById(id: string): Promise<any> {
  const res = await query<any>(`${SELECT_EXAMEN} WHERE e.id = $1`, [id]);
  if (res.rows.length === 0) throw new HttpError(404, "Examen id=" + id + " no encontrado");
  const examen = await mapExamen(res.rows[0]);

  const pRes = await query<any>(`SELECT id, examen_id, enunciado, tipo, opciones, respuesta_correcta, puntaje, orden, tema_id FROM preguntas_examen WHERE examen_id = $1 ORDER BY orden`, [id]);
  examen.preguntas = pRes.rows.map((r: any) => ({
    id: toId(r.id), examenId: toId(r.examen_id), enunciado: r.enunciado, tipo: r.tipo,
    opciones: r.opciones, respuestaCorrecta: r.respuesta_correcta, puntaje: Number(r.puntaje),
    orden: Number(r.orden), temaId: r.tema_id ? toId(r.tema_id) : undefined,
  }));

  return examen;
}

export async function createExamen(input: CreateExamenInput): Promise<any> {
  const matId = String(input.materiaId ?? "").trim();
  const asigId = String(input.asignacionId ?? "").trim();
  const cpId = String(input.cursoPeriodoId ?? "").trim();
  const trimestre = Number(input.trimestre);

  if (![1,2,3].includes(trimestre)) throw new HttpError(400, "trimestre 1-3");
  if (!input.titulo?.trim()) throw new HttpError(400, "titulo requerido");
  if (!input.fechaExamen) throw new HttpError(400, "fechaExamen requerida");
  if (!input.horaInicio || !input.horaFin) throw new HttpError(400, "horaInicio y horaFin requeridas");
  if (!Array.isArray(input.preguntas) || input.preguntas.length === 0) throw new HttpError(400, "Al menos 1 pregunta");

  const matRes = await query<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1`, [input.materiaId]);
  if (!matRes.rows.length) throw new HttpError(404, "Materia no encontrada");
  const asigRes = await query<{ id: bigint }>(`SELECT id FROM asignaciones_docentes WHERE id = $1`, [input.asignacionId]);
  if (!asigRes.rows.length) throw new HttpError(404, "Asignacion no encontrada");
  const cpRes = await query<{ id: bigint }>(`SELECT id FROM cursos_periodo WHERE id = $1`, [input.cursoPeriodoId]);
  if (!cpRes.rows.length) throw new HttpError(404, "Curso periodo no encontrado");

  const totalPeso = input.preguntas.reduce((s: number, p: any) => s + Number(p.puntaje ?? 0), 0);
  if (totalPeso !== 100) throw new HttpError(400, "La suma de puntajes debe ser 100");

  try {
    return await sTransaction(async (client) => {
      const examenRes = await client.queryObject<{ id: bigint }>(
        `INSERT INTO examenes_parciales (materia_id, asignacion_id, curso_periodo_id, trimestre, titulo, descripcion, fecha_examen, hora_inicio, hora_fin, peso_total, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [input.materiaId, input.asignacionId, input.cursoPeriodoId, trimestre, input.titulo.trim(), input.descripcion?.trim() ?? null, input.fechaExamen, input.horaInicio, input.horaFin, totalPeso, "programado"],
      );
      const examenId = toId(examenRes.rows[0].id);

      for (const [idx, p] of input.preguntas.entries()) {
        await client.queryObject(
          `INSERT INTO preguntas_examen (examen_id, enunciado, tipo, opciones, respuesta_correcta, puntaje, orden, tema_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [examenId, p.enunciado.trim(), p.tipo, JSON.stringify(p.opciones ?? []), p.respuestaCorrecta ?? null, p.puntaje, idx + 1, p.temaId ?? null],
        );
      }

      publicarEventoConfig("examenRegistrado", { examenId, materiaId: input.materiaId, trimestre, titulo: input.titulo, fechaExamen: input.fechaExamen, totalPreguntas: input.preguntas.length, timestamp: new Date().toISOString() });

      return await getExamenById(toId(examenId));
    });
  } catch (err) {
    throw mapDbError(err, "Error al crear examen");
  }
}

export async function updateExamen(id: string, input: any): Promise<any> {
  const res = await query(`SELECT id FROM examenes_parciales WHERE id = $1`, [id]);
  if (!res.rows.length) throw new HttpError(404, "Examen no encontrado");

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.titulo !== undefined) { if (!input.titulo.trim()) throw new HttpError(400, "titulo vacio"); fields.push(`titulo = $${idx++}`); params.push(input.titulo.trim()); }
  if (input.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); params.push(input.descripcion?.trim() ?? null); }
  if (input.fechaExamen !== undefined) { fields.push(`fecha_examen = $${idx++}`); params.push(input.fechaExamen); }
  if (input.horaInicio !== undefined) { fields.push(`hora_inicio = $${idx++}`); params.push(input.horaInicio); }
  if (input.horaFin !== undefined) { fields.push(`hora_fin = $${idx++}`); params.push(input.horaFin); }
  if (input.estado !== undefined) { fields.push(`estado = $${idx++}`); params.push(input.estado); }

  if (!fields.length) throw new HttpError(400, "Sin campos");

  try {
    params.push(id);
    await query(`UPDATE examenes_parciales SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getExamenById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar examen");
  }
}

export async function deleteExamen(id: string): Promise<void> {
  await query(`SELECT id FROM examenes_parciales WHERE id = $1`, [id]).then(r => { if (!r.rows.length) throw new HttpError(404, "Examen no encontrado"); });
  try {
    await query(`DELETE FROM preguntas_examen WHERE examen_id = $1`, [id]);
    await query(`DELETE FROM examenes_parciales WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar examen");
  }
}

export async function responderExamen(input: { examenId: string; estudianteId: string; respuestas: Array<{ preguntaId: string; respuesta: string | string[]; tiempoMs?: number }> }): Promise<any> {
  const examen = await getExamenById(input.examenId);
  if (examen.estado !== "en_curso") throw new HttpError(400, "El examen no esta en curso");

  return await sTransaction(async (client) => {
    const resultados: any[] = [];
    let totalPuntaje = 0;

    for (const r of input.respuestas) {
      const pRes = await client.queryObject<{ id: bigint; tipo: string; respuesta_correcta: string; puntaje: number }>(
        `SELECT id, tipo, respuesta_correcta, puntaje FROM preguntas_examen WHERE id = $1 AND examen_id = $2`,
        [r.preguntaId, input.examenId],
      );
      if (!pRes.rows.length) continue;
      const p = pRes.rows[0];

      let correcta = false;
      if (p.tipo === "opcion_multiple" || p.tipo === "verdadero_falso") {
        correcta = String(r.respuesta).trim() === String(p.respuesta_correcta).trim();
      } else if (p.tipo === "completar" || p.tipo === "desarrollo") {
        correcta = String(r.respuesta).trim().toLowerCase() === String(p.respuesta_correcta).trim().toLowerCase();
      } else if (p.tipo === "emparejar") {
        const rArr = Array.isArray(r.respuesta) ? r.respuesta : [r.respuesta];
        const cArr = Array.isArray(p.respuesta_correcta) ? p.respuesta_correcta : [p.respuesta_correcta];
        correcta = JSON.stringify(rArr.sort()) === JSON.stringify(cArr.sort());
      }

      const puntajeObt = correcta ? Number(p.puntaje) : 0;
      totalPuntaje += puntajeObt;

      await client.queryObject(
        `INSERT INTO respuestas_examen (examen_id, estudiante_id, pregunta_id, respuesta, correcta, puntaje_obtenido, tiempo_respuesta_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [input.examenId, input.estudianteId, r.preguntaId, JSON.stringify(r.respuesta), correcta, puntajeObt, r.tiempoMs ?? null],
      );

      resultados.push({ preguntaId: r.preguntaId, correcta, puntajeObtenido: puntajeObt });
    }

    return { examenId: input.examenId, estudianteId: input.estudianteId, totalPuntaje, resultados, fechaRespuesta: new Date().toISOString() };
  });
}

export async function getResultadosExamen(examenId: string): Promise<any> {
  const res = await query<any>(
    `SELECT re.id, re.estudiante_id, u.nombre, u.apellido_paterno, u.apellido_materno,
            SUM(re.puntaje_obtenido) AS total_puntaje, COUNT(*) AS total_preguntas,
            SUM(CASE WHEN re.correcta THEN 1 ELSE 0 END) AS correctas,
            re.fecha_respuesta
     FROM respuestas_examen re
     JOIN estudiantes e ON e.id = re.estudiante_id
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE re.examen_id = $1
     GROUP BY re.estudiante_id, u.nombre, u.apellido_paterno, u.apellido_materno, re.fecha_respuesta
     ORDER BY total_puntaje DESC`,
    [examenId],
  );

  return {
    examenId,
    resultados: res.rows.map((r: any) => ({
      estudianteId: toId(r.estudiante_id),
      nombreCompleto: (r.nombre + " " + r.apellido_paterno + " " + (r.apellido_materno || "")).trim(),
      totalPuntaje: Number(r.total_puntaje),
      totalPreguntas: Number(r.total_preguntas),
      correctas: Number(r.correctas),
      porcentaje: r.total_preguntas > 0 ? Math.round((Number(r.correctas) / Number(r.total_preguntas)) * 10000) / 100 : 0,
      fechaRespuesta: r.fecha_respuesta,
    })),
  };
}