import { query, sTransaction } from "../connects/Database/transaction.ts";
import { withRetry } from "../connects/Database/reintento.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { publicarEventoControl, publicarEventoConfig } from "../utils/events.ts";
import {
  CalificacionControl,
  CreateCalificacionInput,
  UpdateCalificacionInput,
  BulkCalificacionInput,
  FiltroCalificaciones,
  TipoEvaluacion,
  TrimestreNumero,
  TIPOS_EVALUACION,
  TRIMESTRES,
} from "../models/control-academico.ts";

interface CalificacionRowDB {
  id: bigint;
  estudianteId: bigint;
  asignacionId: bigint;
  materiaId: bigint;
  temaId?: bigint | null;
  tipoEvaluacion: string;
  trimestre: number;
  nota: number;
  observacion?: string | null;
  peso: number;
  fechaEvaluacion: Date | string;
  fechaRegistro: Date | string;
  fechaActualizacion: Date | string;
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  materiaNombre?: string;
  cursoPeriodoId?: bigint;
  cursoNombre?: string;
  temaTitulo?: string;
  temaUnidad?: number;
}

async function mapCalificacion(row: CalificacionRowDB): Promise<CalificacionControl> {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    asignacionId: toId(row.asignacionId),
    materiaId: toId(row.materiaId),
    temaId: row.temaId ? toId(row.temaId) : undefined,
    tipoEvaluacion: row.tipoEvaluacion as any,
    trimestre: row.trimestre as any,
    nota: Number(row.nota),
    observacion: row.observacion ?? null,
    peso: Number(row.peso),
    fechaEvaluacion: (asDateString(row.fechaEvaluacion) as string) ?? new Date().toISOString().split("T")[0],
    fechaRegistro: (asDateTimeString(row.fechaRegistro) as string) ?? new Date().toISOString(),
    fechaActualizacion: (asDateTimeString(row.fechaActualizacion) as string) ?? new Date().toISOString(),
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      }
      : null,
    asignacion: row.materiaNombre
      ? {
        id: toId(row.asignacionId),
        materiaNombre: row.materiaNombre,
        cursoPeriodoId: row.cursoPeriodoId ? toId(row.cursoPeriodoId) : undefined,
        cursoNombre: row.cursoNombre,
      }
      : null,
    tema: row.temaTitulo
      ? {
        id: toId(row.temaId ?? 0),
        titulo: row.temaTitulo,
        unidad: row.temaUnidad,
      }
      : null,
  });
}

const SELECT = `
  SELECT
    c.id,
    c.estudiante_id AS "estudianteId",
    c.asignacion_id AS "asignacionId",
    c.materia_id AS "materiaId",
    c.tema_id AS "temaId",
    c.tipo_evaluacion AS "tipoEvaluacion",
    c.trimestre,
    c.nota,
    c.observacion,
    c.peso,
    c.fecha_evaluacion AS "fechaEvaluacion",
    c.fecha_registro AS "fechaRegistro",
    c.fecha_actualizacion AS "fechaActualizacion",
    e.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    m.nombre AS "materiaNombre",
    cp.id AS "cursoPeriodoId",
    c.grado || '° "' || c.paralelo || '" ' || c.nivel AS "cursoNombre",
    t.titulo AS "temaTitulo",
    t.unidad AS "temaUnidad"
  FROM calificaciones_control c
  JOIN estudiantes e ON e.id = c.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
  JOIN asignaciones_docentes ad ON ad.id = c.asignacion_id
  JOIN materias m ON m.id = c.materia_id
  JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  LEFT JOIN malla_temas t ON t.id = c.tema_id
`;

export async function listCalificaciones(
  pagination: { page: number; limit: number; offset: number },
  filters: any,
): Promise<{ data: CalificacionControl[]; total: number; page: number; limit: number; totalPages: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.asignacionId) {
    if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId debe ser numérico");
    conditions.push(`c.asignacion_id = $${idx++}`);
    params.push(filters.asignacionId);
  }
  if (filters.estudianteId) {
    if (!/^\d+$/.test(filters.estudianteId)) throw new HttpError(400, "estudianteId debe ser numérico");
    conditions.push(`c.estudiante_id = $${idx++}`);
    params.push(filters.estudianteId);
  }
  if (filters.materiaId) {
    if (!/^\d+$/.test(filters.materiaId)) throw new HttpError(400, "materiaId debe ser numérico");
    conditions.push(`c.materia_id = $${idx++}`);
    params.push(filters.materiaId);
  }
  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`ad.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.trimestre) {
    if (![1, 2, 3].includes(Number(filters.trimestre))) throw new HttpError(400, "trimestre debe ser 1, 2 o 3");
    conditions.push(`c.trimestre = $${idx++}`);
    params.push(Number(filters.trimestre));
  }
  if (filters.tipoEvaluacion) {
    conditions.push(`c.tipo_evaluacion = $${idx++}`);
    params.push(filters.tipoEvaluacion);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<any>(
        `SELECT
           c.id, c.estudiante_id AS "estudianteId", c.asignacion_id AS "asignacionId",
           c.materia_id AS "materiaId", c.tema_id AS "temaId", c.tipo_evaluacion AS "tipoEvaluacion",
           c.trimestre, c.nota, c.observacion, c.peso,
           c.fecha_evaluacion AS "fechaEvaluacion", c.fecha_registro AS "fechaRegistro",
           c.fecha_actualizacion AS "fechaActualizacion",
           e.usuario_id AS "usuarioId", u.nombre, u.apellido_paterno AS "apellidoPaterno",
           u.apellido_materno AS "apellidoMaterno", m.nombre AS "materiaNombre",
           cp.id AS "cursoPeriodoId",
           c.grado || '° "' || c.paralelo || '" ' || c.nivel AS "cursoNombre",
           t.titulo AS "temaTitulo", t.unidad AS "temaUnidad"
         FROM calificaciones_control c
         JOIN estudiantes e ON e.id = c.estudiante_id
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN asignaciones_docentes ad ON ad.id = c.asignacion_id
         JOIN materias m ON m.id = c.materia_id
         JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
         JOIN cursos c ON c.id = cp.curso_id
         LEFT JOIN malla_temas t ON t.id = c.tema_id
         ${where} ORDER BY c.fecha_evaluacion DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM calificaciones_control c
         JOIN estudiantes e ON e.id = c.estudiante_id
         JOIN asignaciones_docentes ad ON ad.id = c.asignacion_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const data = dataRes.rows.map((row: any) => ({
      id: toId(row.id),
      estudianteId: toId(row.estudianteId),
      asignacionId: toId(row.asignacionId),
      materiaId: toId(row.materiaId),
      temaId: row.temaId ? toId(row.temaId) : undefined,
      tipoEvaluacion: row.tipoEvaluacion,
      trimestre: Number(row.trimestre),
      nota: Number(row.nota),
      observacion: row.observacion,
      peso: Number(row.peso),
      fechaEvaluacion: asDateString(row.fechaEvaluacion),
      fechaRegistro: asDateTimeString(row.fechaRegistro),
      fechaActualizacion: asDateTimeString(row.fechaActualizacion),
      estudiante: {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      },
      asignacion: {
        id: toId(row.asignacionId),
        materiaNombre: row.materiaNombre,
        cursoPeriodoId: row.cursoPeriodoId ? toId(row.cursoPeriodoId) : undefined,
        cursoNombre: row.cursoNombre,
      },
      tema: row.temaTitulo ? { id: toId(row.temaId ?? 0), titulo: row.temaTitulo, unidad: row.temaUnidad } : null,
    }));

    return { data, total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit) || 0 };
  } catch (err) {
    throw mapDbError(err, "Error al listar calificaciones");
  }
}

export async function getCalificacionById(id: string): Promise<any> {
  const res = await query<any>(
    `SELECT
       c.id, c.estudiante_id AS "estudianteId", c.asignacion_id AS "asignacionId",
       c.materia_id AS "materiaId", c.tema_id AS "temaId", c.tipo_evaluacion AS "tipoEvaluacion",
       c.trimestre, c.nota, c.observacion, c.peso,
       c.fecha_evaluacion AS "fechaEvaluacion", c.fecha_registro AS "fechaRegistro",
       c.fecha_actualizacion AS "fechaActualizacion",
       e.usuario_id AS "usuarioId", u.nombre, u.apellido_paterno AS "apellidoPaterno",
       u.apellido_materno AS "apellidoMaterno", m.nombre AS "materiaNombre",
       cp.id AS "cursoPeriodoId", t.titulo AS "temaTitulo", t.unidad AS "temaUnidad"
     FROM calificaciones_control c
     JOIN estudiantes e ON e.id = c.estudiante_id
     JOIN usuarios u ON u.id = e.usuario_id
     JOIN materias m ON m.id = c.materia_id
     LEFT JOIN malla_temas t ON t.id = c.tema_id
     WHERE c.id = $1`,
    [id],
  );
  if (res.rows.length === 0) throw new HttpError(404, `Calificación id=${id} no encontrada`);
  const row = res.rows[0];
  return {
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    asignacionId: toId(row.asignacionId),
    materiaId: toId(row.materiaId),
    temaId: row.temaId ? toId(row.temaId) : undefined,
    tipoEvaluacion: row.tipoEvaluacion,
    trimestre: Number(row.trimestre),
    nota: Number(row.nota),
    observacion: row.observacion,
    peso: Number(row.peso),
    fechaEvaluacion: asDateString(row.fechaEvaluacion),
    fechaRegistro: asDateTimeString(row.fechaRegistro),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
    estudiante: { id: toId(row.estudianteId), usuarioId: toId(row.usuarioId), nombre: row.nombre, apellidoPaterno: row.apellidoPaterno, apellidoMaterno: row.apellidoMaterno },
    asignacion: { id: toId(row.asignacionId), materiaNombre: row.materiaNombre },
  };
}

export async function createCalificacion(input: any): Promise<any> {
  let estId = String(input.estudianteId ?? "").trim();
  const asigId = String(input.asignacionId ?? "").trim();
  const matId = String(input.materiaId ?? "").trim();
  const trimestre = Number(input.trimestre);
  const tipoEvaluacion = input.tipoEvaluacion;
  const nota = Number(input.nota);
  const peso = Number(input.peso ?? 100);

  if (!estId || !asigId || !matId) throw new HttpError(400, "estudianteId, asignacionId y materiaId son requeridos");
  if (![1, 2, 3].includes(trimestre)) throw new HttpError(400, "trimestre debe ser 1, 2 o 3");
  if (!["parcial", "final", "trimestral", "bimestral", "quiz", "tarea", "proyecto"].includes(tipoEvaluacion)) {
    throw new HttpError(400, "tipoEvaluacion inválido");
  }
  if (isNaN(nota) || nota < 0 || nota > 100) throw new HttpError(400, "nota debe ser entre 0 y 100");
  if (isNaN(peso) || peso < 1 || peso > 100) throw new HttpError(400, "peso debe ser entre 1 y 100");

  const estRes = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`, [input.estudianteId]);
  if (estRes.rows.length > 0) estId = toId(estRes.rows[0].id);
  else {
    const r2 = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE id = $1 LIMIT 1`, [input.estudianteId]);
    if (!r2.rows.length) throw new HttpError(404, "Estudiante no encontrado");
    estId = toId(r2.rows[0].id);
  }

  const asigRes = await query<{ id: bigint }>(`SELECT id FROM asignaciones_docentes WHERE id = $1`, [asigId]);
  if (!asigRes.rows.length) throw new HttpError(404, "Asignación no encontrada");

  const matRes = await query<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1`, [matId]);
  if (!matRes.rows.length) throw new HttpError(404, "Materia no encontrada");

  const temaId = input.temaId ? String(input.temaId).trim() : null;
  if (temaId) {
    const tRes = await query<{ id: bigint }>(`SELECT id FROM malla_temas WHERE id = $1`, [temaId]);
    if (!tRes.rows.length) throw new HttpError(404, "Tema no encontrado");
  }

  const fechaEval = input.fechaEvaluacion || new Date().toISOString().split("T")[0];

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO calificaciones_control (
         estudiante_id, asignacion_id, materia_id, tema_id, tipo_evaluacion, trimestre,
         nota, observacion, peso, fecha_evaluacion
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (estudiante_id, asignacion_id, materia_id, tipo_evaluacion, trimestre)
       DO UPDATE SET
         nota = EXCLUDED.nota,
         observacion = EXCLUDED.observacion,
         peso = EXCLUDED.peso,
         fecha_evaluacion = EXCLUDED.fecha_evaluacion,
         fecha_actualizacion = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        input.estudianteId, asigId, matId,
        input.temaId ?? null,
        input.tipoEvaluacion, trimestre,
        nota, input.observacion?.trim() ?? null,
        peso, fechaEval,
      ],
    );

    const createdRes = await query<any>(
      `SELECT c.id, c.estudiante_id, c.asignacion_id, c.materia_id, c.tema_id, c.tipo_evaluacion,
              c.trimestre, c.nota, c.observacion, c.peso, c.fecha_evaluacion, c.fecha_registro,
              c.fecha_actualizacion, e.usuario_id, u.nombre, u.apellido_paterno, u.apellido_materno,
              m.nombre AS materia_nombre, cp.id AS curso_periodo_id
       FROM calificaciones_control c
       JOIN estudiantes e ON e.id = c.estudiante_id
       JOIN usuarios u ON u.id = e.usuario_id
       JOIN materias m ON m.id = c.materia_id
       JOIN asignaciones_docentes ad ON ad.id = c.asignacion_id
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       WHERE c.id = $1`,
      [res.rows[0].id],
    );

    const row = createdRes.rows[0];
    const created = {
      id: toId(row.id),
      estudianteId: toId(row.estudianteId),
      asignacionId: toId(row.asignacionId),
      materiaId: toId(row.materiaId),
      temaId: row.temaId ? toId(row.temaId) : undefined,
      tipoEvaluacion: row.tipoEvaluacion,
      trimestre: Number(row.trimestre),
      nota: Number(row.nota),
      observacion: row.observacion,
      peso: Number(row.peso),
      fechaEvaluacion: asDateString(row.fechaEvaluacion),
      fechaRegistro: row.fechaRegistro,
      fechaActualizacion: row.fechaActualizacion,
    };

    publicarEventoControl("control:calificacion_registrada", {
      calificacionId: created.id,
      estudianteId: created.estudianteId,
      asignacionId: created.asignacionId,
      materiaId: created.materiaId,
      trimestre: created.trimestre,
      tipoEvaluacion: created.tipoEvaluacion,
      nota: created.nota,
      peso: created.peso,
      timestamp: new Date().toISOString(),
    });

    return created;
  } catch (err) {
    throw mapDbError(err, "Error al crear calificación");
  }
}

export async function updateCalificacion(id: string, input: any): Promise<any> {
  await query(`SELECT id FROM calificaciones_control WHERE id = $1`, [id]).then(r => {
    if (!r.rows.length) throw new HttpError(404, "Calificación no encontrada");
  });

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.nota !== undefined) {
    const n = Number(input.nota);
    if (isNaN(n) || n < 0 || n > 100) throw new HttpError(400, "nota debe ser entre 0 y 100");
    fields.push(`nota = $${idx++}`); params.push(n);
  }
  if (input.observacion !== undefined) { fields.push(`observacion = $${idx++}`); params.push(input.observacion?.trim() ?? null); }
  if (input.peso !== undefined) { fields.push(`peso = $${idx++}`); params.push(Number(input.peso)); }

  if (!fields.length) throw new HttpError(400, "No hay campos para actualizar");
  fields.push(`fecha_actualizacion = CURRENT_TIMESTAMP`);

  try {
    params.push(id);
    await query(`UPDATE calificaciones_control SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await query<any>(
      `SELECT c.id, c.estudiante_id, c.asignacion_id, c.materia_id, c.tipo_evaluacion,
              c.trimestre, c.nota, c.observacion, c.peso, c.fecha_evaluacion, c.fecha_registro
       FROM calificaciones_control c WHERE c.id = $1`,
      [id],
    ).then(r => r.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar calificación");
  }
}

export async function saveBulkCalificaciones(input: any): Promise<{ totalGuardados: number }> {
  const asigId = String(input.asignacionId ?? "").trim();
  const matId = String(input.materiaId ?? "").trim();
  const trimestre = Number(input.trimestre);
  const tipoEvaluacion = input.tipoEvaluacion;

  if (!asigId || !matId) throw new HttpError(400, "asignacionId y materiaId requeridos");
  if (![1, 2, 3].includes(trimestre)) throw new HttpError(400, "trimestre inválido");
  if (!["parcial", "final", "trimestral", "bimestral", "quiz", "tarea", "proyecto"].includes(tipoEvaluacion)) {
    throw new HttpError(400, "tipoEvaluacion inválido");
  }
  if (!Array.isArray(input.calificaciones) || input.calificaciones.length === 0) {
    throw new HttpError(400, "Lista de calificaciones vacía");
  }

  const asigRes = await query<{ id: bigint }>(`SELECT id FROM asignaciones_docentes WHERE id = $1`, [asigId]);
  if (!asigRes.rows.length) throw new HttpError(404, "Asignación no encontrada");

  await sTransaction(async (client) => {
    for (const item of input.calificaciones) {
      const nota = Number(item.nota);
      const peso = Number(item.peso ?? 100);
      if (isNaN(nota) || nota < 0 || nota > 100) continue;

      const estRes = await client.queryObject<{ id: bigint }>(`SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`, [String(item.estudianteId)]);
      let estId: string;
      if (estRes.rows.length > 0) estId = toId(estRes.rows[0].id);
      else {
        const r2 = await client.queryObject<{ id: bigint }>(`SELECT id FROM estudiantes WHERE id = $1 LIMIT 1`, [String(item.estudianteId)]);
        if (!r2.rows.length) continue;
        estId = toId(r2.rows[0].id);
      }

      await client.queryObject(
        `INSERT INTO calificaciones_control (
           estudiante_id, asignacion_id, materia_id, tipo_evaluacion, trimestre,
           nota, observacion, peso, fecha_evaluacion
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (estudiante_id, asignacion_id, materia_id, tipo_evaluacion, trimestre)
         DO UPDATE SET nota = EXCLUDED.nota, observacion = EXCLUDED.observacion, peso = EXCLUDED.peso,
         fecha_actualizacion = CURRENT_TIMESTAMP`,
        [String(item.estudianteId), asigId, matId, tipoEvaluacion, trimestre, nota, item.observacion?.trim() ?? null, peso, new Date().toISOString().split("T")[0]],
      );
    }
  });

  return { totalGuardados: input.calificaciones.length };
}

export async function getReporteCalificacionesMateria(materiaId: string, cursoPeriodoId: string, trimestre: number): Promise<any> {
  const res = await query<any>(
    `SELECT
       e.id AS estudiante_id,
       u.nombre, u.apellido_paterno, u.apellido_materno,
       c.tipo_evaluacion, c.nota, c.peso, c.fecha_evaluacion, c.trimestre,
       c.tema_id
     FROM calificaciones_control c
     JOIN estudiantes e ON e.id = c.estudiante_id
     JOIN usuarios u ON u.id = e.usuario_id
     JOIN asignaciones_docentes ad ON ad.id = c.asignacion_id
     JOIN inscripciones i ON i.estudiante_id = e.id AND i.estado = 'activo'
     WHERE c.materia_id = $1 AND ad.curso_periodo_id = $2 AND c.trimestre = $3
     AND i.curso_periodo_id = $2 AND i.estado = 'activo'
     ORDER BY u.apellido_paterno, u.nombre, c.fecha_evaluacion`,
    [materiaId, cursoPeriodoId, trimestre],
  );

  const estudiantesMap = new Map<string, any>();
  for (const row of res.rows) {
    const estId = String(row.estudiante_id);
    if (!estudiantesMap.has(estId)) {
      estudiantesMap.set(estId, {
        estudianteId: String(row.estudiante_id),
        nombreCompleto: `${row.nombre} ${row.apellido_paterno} ${row.apellido_materno || ""}`.trim(),
        notas: [],
      });
    }
    const est = estudiantesMap.get(String(row.estudiante_id));
    est.notas.push({
      tipo: row.tipo_evaluacion,
      tema: row.tema_id ? String(row.tema_id) : undefined,
      nota: Number(row.nota),
      peso: Number(row.peso),
      fecha: row.fecha_evaluacion,
    });
  }

  const estudiantes = Array.from(estudiantesMap.values()).map(est => {
    const totalPeso = est.notas.reduce((sum, n) => sum + n.peso, 0);
    const promedioPonderado = totalPeso > 0
      ? est.notas.reduce((sum, n) => sum + n.nota * n.peso, 0) / totalPeso
      : 0;
    const promedioTrimestre = est.notas.length > 0
      ? est.notas.reduce((sum, n) => sum + n.nota, 0) / est.notas.length
      : 0;
    let estado = "aprobado";
    if (promedioPonderado < 51) estado = "reprobado";
    else if (promedioPonderado < 61) estado = "en_riesgo";
    return { ...est, promedioPonderado: Math.round(promedioPonderado * 100) / 100, promedioTrimestre: Math.round(promedioTrimestre * 100) / 100, estado };
  });

  const promedioCurso = estudiantes.length > 0
    ? estudiantes.reduce((s, e) => s + e.promedioPonderado, 0) / estudiantes.length
    : 0;

  return {
    materiaId,
    trimestre,
    estudiantes,
    estadisticas: {
      promedioCurso: Math.round(promedioCurso * 100) / 100,
      aprobados: estudiantes.filter(e => e.estado === "aprobado").length,
      reprobados: estudiantes.filter(e => e.estado === "reprobado").length,
      enRiesgo: estudiantes.filter(e => e.estado === "en_riesgo").length,
    },
  };
}