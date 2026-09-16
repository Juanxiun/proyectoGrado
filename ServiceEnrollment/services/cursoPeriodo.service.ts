import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreateCursoPeriodoInput,
  CursoPeriodo,
  ESTADOS_CURSO_PERIODO,
  EstadoCursoPeriodo,
  PaginatedResult,
  PaginationQuery,
  UpdateCursoPeriodoInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";

interface CursoPeriodoRow {
  id: bigint;
  cursoId: bigint;
  periodoId: bigint;
  capacidadMaxima: number;
  estado: EstadoCursoPeriodo;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  cursoActivo?: boolean;
  cursoCapacidad?: number;
  anio?: number;
  periodoNombre?: string;
  fechaInicio?: Date | string;
  fechaFin?: Date | string;
  periodoActivo?: boolean;
  totalInscritos?: string | number;
}

function mapCursoPeriodo(row: CursoPeriodoRow): CursoPeriodo {
  return serialize({
    id: toId(row.id),
    cursoId: toId(row.cursoId),
    periodoId: toId(row.periodoId),
    capacidadMaxima: Number(row.capacidadMaxima),
    estado: row.estado,
    totalInscritos: Number(row.totalInscritos ?? 0),
    curso: row.nivel
      ? {
        id: toId(row.cursoId),
        nivel: row.nivel,
        grado: row.grado,
        paralelo: row.paralelo,
        capacidadMaxima: Number(row.cursoCapacidad ?? 0),
        activo: Boolean(row.cursoActivo),
      }
      : null,
    periodo: row.periodoNombre
      ? {
        id: toId(row.periodoId),
        anio: Number(row.anio),
        nombre: row.periodoNombre,
        fechaInicio: asDateString(row.fechaInicio),
        fechaFin: asDateString(row.fechaFin),
        activo: Boolean(row.periodoActivo),
      }
      : null,
  });
}

function parseEstado(value: unknown): EstadoCursoPeriodo {
  const estado = String(value ?? "").trim().toLowerCase() as EstadoCursoPeriodo;
  if (!ESTADOS_CURSO_PERIODO.includes(estado)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS_CURSO_PERIODO.join(", ")}`);
  }
  return estado;
}

const SELECT = `
  SELECT
    cp.id,
    cp.curso_id AS "cursoId",
    cp.periodo_id AS "periodoId",
    cp.capacidad_maxima AS "capacidadMaxima",
    cp.estado,
    c.nivel,
    c.grado,
    c.paralelo,
    c.capacidad_maxima AS "cursoCapacidad",
    c.activo AS "cursoActivo",
    p.anio,
    p.nombre AS "periodoNombre",
    p.fecha_inicio AS "fechaInicio",
    p.fecha_fin AS "fechaFin",
    p.activo AS "periodoActivo",
    (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo') AS "totalInscritos"
  FROM cursos_periodo cp
  JOIN cursos c ON c.id = cp.curso_id
  JOIN periodos_academicos p ON p.id = cp.periodo_id
`;

export async function listCursosPeriodo(
  pagination: PaginationQuery,
  filters: { cursoId?: string; periodoId?: string; estado?: string; anio?: string },
): Promise<PaginatedResult<CursoPeriodo>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.cursoId) {
    if (!/^\d+$/.test(filters.cursoId)) throw new HttpError(400, "cursoId debe ser numérico");
    conditions.push(`cp.curso_id = $${idx++}`);
    params.push(filters.cursoId);
  }
  if (filters.periodoId) {
    if (!/^\d+$/.test(filters.periodoId)) throw new HttpError(400, "periodoId debe ser numérico");
    conditions.push(`cp.periodo_id = $${idx++}`);
    params.push(filters.periodoId);
  }
  if (filters.anio) {
    if (!/^\d+$/.test(filters.anio)) throw new HttpError(400, "anio debe ser numérico");
    conditions.push(`p.anio = $${idx++}`);
    params.push(Number(filters.anio));
  }
  if (filters.estado) {
    conditions.push(`cp.estado = $${idx++}`);
    params.push(parseEstado(filters.estado));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<CursoPeriodoRow>(
        `${SELECT} ${where} ORDER BY p.anio DESC, c.nivel, c.grado, c.paralelo LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM cursos_periodo cp
         JOIN cursos c ON c.id = cp.curso_id
         JOIN periodos_academicos p ON p.id = cp.periodo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapCursoPeriodo),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar cursos del periodo");
  }
}

export async function getCursoPeriodoById(id: string): Promise<CursoPeriodo> {
  const res = await query<CursoPeriodoRow>(`${SELECT} WHERE cp.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Curso-Periodo id=${id} no encontrado`);
  }
  return mapCursoPeriodo(res.rows[0]);
}

export async function createCursoPeriodo(input: CreateCursoPeriodoInput): Promise<CursoPeriodo> {
  const cursoId = String(input.cursoId ?? "").trim();
  const periodoId = String(input.periodoId ?? "").trim();
  if (!/^\d+$/.test(cursoId)) throw new HttpError(400, "cursoId debe ser numérico");
  if (!/^\d+$/.test(periodoId)) throw new HttpError(400, "periodoId debe ser numérico");

  const [cursoRes, periodoRes] = await Promise.all([
    query<{ id: bigint; capacidad_maxima: number }>(`SELECT id, capacidad_maxima FROM cursos WHERE id = $1`, [cursoId]),
    query<{ id: bigint; activo: boolean }>(`SELECT id, activo FROM periodos_academicos WHERE id = $1`, [periodoId]),
  ]);

  if (cursoRes.rows.length === 0) throw new HttpError(404, `Curso id=${cursoId} no encontrado`);
  if (periodoRes.rows.length === 0) throw new HttpError(404, `Periodo id=${periodoId} no encontrado`);

  const capacidad = Number(input.capacidadMaxima ?? cursoRes.rows[0].capacidad_maxima);
  if (!Number.isInteger(capacidad) || capacidad < 1) {
    throw new HttpError(400, "capacidadMaxima debe ser un entero mayor a 0");
  }

  const estado = input.estado ? parseEstado(input.estado) : "activo";

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [cursoId, periodoId, capacidad, estado],
    );
    return await getCursoPeriodoById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al asociar curso con periodo académico");
  }
}

export async function updateCursoPeriodo(id: string, input: UpdateCursoPeriodoInput): Promise<CursoPeriodo> {
  await getCursoPeriodoById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.capacidadMaxima !== undefined) {
    const capacidad = Number(input.capacidadMaxima);
    if (!Number.isInteger(capacidad) || capacidad < 1) {
      throw new HttpError(400, "capacidadMaxima debe ser un entero mayor a 0");
    }
    fields.push(`capacidad_maxima = $${idx++}`);
    params.push(capacidad);
  }
  if (input.estado !== undefined) {
    fields.push(`estado = $${idx++}`);
    params.push(parseEstado(input.estado));
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    await query(`UPDATE cursos_periodo SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getCursoPeriodoById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar curso del periodo");
  }
}

export async function deleteCursoPeriodo(id: string): Promise<void> {
  await getCursoPeriodoById(id);
  try {
    await query(`DELETE FROM cursos_periodo WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar curso del periodo: existen inscripciones o asignaciones asociadas");
  }
}
