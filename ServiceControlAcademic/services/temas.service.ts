import { query, sTransaction } from "../connects/Database/transaction.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { publicarEventoControl, publicarEventoConfig } from "../utils/events.ts";
import {
  TemaMallaControl,
  TemaProgreso,
  controlAcademicoConfig,
} from "../models/control-academico.ts";

interface TemaRowDB {
  id: bigint;
  materiaId: bigint;
  unidad: number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas: number;
  esEvaluacion: boolean;
  orden: number;
  activo: boolean;
  materiaNombre?: string;
  materiaCodigo?: string;
}

async function mapTema(row: TemaRowDB): Promise<TemaMallaControl> {
  return serialize({
    id: toId(row.id),
    materiaId: toId(row.materiaId),
    unidad: Number(row.unidad),
    titulo: row.titulo,
    contenidos: row.contenidos,
    horasPrevistas: Number(row.horasPrevistas),
    esEvaluacion: Boolean(row.esEvaluacion),
    orden: Number(row.orden),
    activo: Boolean(row.activo),
    materia: row.materiaNombre
      ? { id: toId(row.materiaId), nombre: row.materiaNombre, codigo: row.materiaCodigo }
      : null,
  });
}

const SELECT = `
  SELECT
    t.id, t.materia_id AS "materiaId", t.unidad, t.titulo, t.contenidos,
    t.horas_previstas AS "horasPrevistas", t.es_evaluacion AS "esEvaluacion",
    t.orden, t.activo, m.nombre AS "materiaNombre", m.codigo AS "materiaCodigo"
  FROM malla_temas t
  JOIN materias m ON m.id = t.materia_id
`;

export async function listTemas(
  pagination: { page: number; limit: number; offset: number },
  filters: { materiaId?: string; unidad?: number; activo?: boolean },
): Promise<{ data: TemaMallaControl[]; total: number; page: number; limit: number; totalPages: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.materiaId) {
    if (!/^\d+$/.test(filters.materiaId)) throw new HttpError(400, "materiaId debe ser numérico");
    conditions.push(`t.materia_id = $${idx++}`);
    params.push(filters.materiaId);
  }
  if (filters.unidad) {
    conditions.push(`t.unidad = $${idx++}`);
    params.push(filters.unidad);
  }
  if (filters.activo !== undefined) {
    conditions.push(`t.activo = $${idx++}`);
    params.push(filters.activo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<any>(`${SELECT} ${where} ORDER BY t.materia_id, t.unidad, t.orden LIMIT $${idx} OFFSET $${idx + 1}`, [...params, pagination.limit, pagination.offset]),
      query<{ total: string }>(`SELECT COUNT(*) AS total FROM malla_temas t ${where}`, params),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data: await Promise.all(dataRes.rows.map(mapTema)), total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit) || 0 };
  } catch (err) {
    throw mapDbError(err, "Error al listar temas");
  }
}

export async function getTemaById(id: string): Promise<any> {
  const res = await query<any>(`${SELECT} WHERE t.id = $1`, [id]);
  if (res.rows.length === 0) throw new HttpError(404, `Tema id=${id} no encontrado`);
  return await mapTema(res.rows[0]);
}

export async function createTema(input: any): Promise<any> {
  const matId = String(input.materiaId ?? "").trim();
  if (!/^\d+$/.test(matId)) throw new HttpError(400, "materiaId debe ser numérico");
  if (!input.titulo?.trim()) throw new HttpError(400, "titulo es obligatorio");
  if (!input.unidad || input.unidad < 1) throw new HttpError(400, "unidad debe ser >= 1");

  const matRes = await query<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1`, [matId]);
  if (!matRes.rows.length) throw new HttpError(404, "Materia no encontrada");

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO malla_temas (materia_id, unidad, titulo, contenidos, horas_previstas, es_evaluacion, orden, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [matId, input.unidad, input.titulo.trim(), input.contenidos?.trim() ?? null, input.horasPrevistas ?? 1, input.esEvaluacion ?? false, input.orden ?? 0, true],
    );
    return await getTemaById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al crear tema");
  }
}

export async function updateTema(id: string, input: any): Promise<any> {
  await query(`SELECT id FROM malla_temas WHERE id = $1`, [id]).then(r => {
    if (!r.rows.length) throw new HttpError(404, "Tema no encontrado");
  });

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.titulo !== undefined) { if (!input.titulo.trim()) throw new HttpError(400, "titulo no puede estar vacío"); fields.push(`titulo = $${idx++}`); params.push(input.titulo.trim()); }
  if (input.contenidos !== undefined) { fields.push(`contenidos = $${idx++}`); params.push(input.contenidos?.trim() ?? null); }
  if (input.unidad !== undefined) { if (input.unidad < 1) throw new HttpError(400, "unidad >= 1"); fields.push(`unidad = $${idx++}`); params.push(input.unidad); }
  if (input.horasPrevistas !== undefined) { fields.push(`horas_previstas = $${idx++}`); params.push(input.horasPrevistas ?? 1); }
  if (input.esEvaluacion !== undefined) { fields.push(`es_evaluacion = $${idx++}`); params.push(input.esEvaluacion); }
  if (input.orden !== undefined) { fields.push(`orden = $${idx++}`); params.push(input.orden); }
  if (input.activo !== undefined) { fields.push(`activo = $${idx++}`); params.push(input.activo); }

  if (!fields.length) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    await query(`UPDATE malla_temas SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await query<any>(`SELECT * FROM malla_temas WHERE id = $1`, [id]).then(r => r.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar tema");
  }
}

export async function deleteTema(id: string): Promise<void> {
  await query(`SELECT id FROM malla_temas WHERE id = $1`, [id]).then(r => {
    if (!r.rows.length) throw new HttpError(404, "Tema no encontrado");
  });
  try {
    await query(`DELETE FROM malla_temas WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar tema");
  }
}

// service -> progreso del estudiante por tema
export async function getProgresoEstudianteTema(estudianteId: string, materiaId: string): Promise<any> {
  const res = await query<any>(
    `SELECT
       t.id AS tema_id, t.titulo, t.unidad, t.es_evaluacion,
       COUNT(c.id) FILTER (WHERE c.estudiante_id = $1) AS total_calificaciones,
       AVG(c.nota) FILTER (WHERE c.estudiante_id = $1) AS promedio,
       MAX(c.fecha_evaluacion) AS ultima_evaluacion
     FROM malla_temas t
     LEFT JOIN calificaciones_control c ON c.tema_id = t.id AND c.estudiante_id = $2
     WHERE t.materia_id = $3 AND t.activo = true
     GROUP BY t.id, t.titulo, t.unidad, t.es_evaluacion
     ORDER BY t.unidad, t.orden`,
    [estudianteId, estudianteId, materiaId],
  );

  return {
    materiaId,
    temas: res.rows.map((r: any) => ({
      temaId: toId(r.tema_id),
      titulo: r.titulo,
      unidad: Number(r.unidad),
      esEvaluacion: Boolean(r.es_evaluacion),
      totalCalificaciones: Number(r.total_calificaciones),
      promedio: r.promedio ? Math.round(Number(r.promedio) * 100) / 100 : null,
      ultimaEvaluacion: r.ultima_evaluacion,
      completado: Number(r.total_calificaciones) > 0,
    })),
  };
}

export async function getTemasMateria(materiaId: string): Promise<TemaMallaControl[]> {
  const res = await query<any>(`${SELECT} WHERE t.materia_id = $1 AND t.activo = true ORDER BY t.unidad, t.orden`, [materiaId]);
  return await Promise.all(res.rows.map(mapTema));
}

export async function getTemasPorUnidad(materiaId: string, unidad: number): Promise<TemaMallaControl[]> {
  const res = await query<any>(`${SELECT} WHERE t.materia_id = $1 AND t.unidad = $2 AND t.activo = true ORDER BY t.orden`, [materiaId, unidad]);
  return await Promise.all(res.rows.map(mapTema));
}

export async function getTemasEvaluacion(materiaId: string): Promise<TemaMallaControl[]> {
  const res = await query<any>(`${SELECT} WHERE t.materia_id = $1 AND t.es_evaluacion = true AND t.activo = true ORDER BY t.unidad, t.orden`, [materiaId]);
  return await Promise.all(res.rows.map(mapTema));
}