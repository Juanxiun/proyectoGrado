import type { Transaction } from "@db/postgres";
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
  turnoId?: bigint | null;
  turnoCodigo?: string;
  turnoNombre?: string;
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
  inicioGestion?: Date | string;
  finGestion?: Date | string;
  periodoActivo?: boolean;
  periodoEstado?: string;
  totalInscritos?: string | number;
}

function mapCursoPeriodo(row: CursoPeriodoRow): CursoPeriodo {
  return serialize({
    id: toId(row.id),
    cursoId: toId(row.cursoId),
    periodoId: toId(row.periodoId),
    turnoId: row.turnoId ? toId(row.turnoId) : null,
    turnoCodigo: row.turnoCodigo,
    turnoNombre: row.turnoNombre,
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
        inicioGestion: asDateString(row.inicioGestion ?? row.fechaInicio),
        finGestion: asDateString(row.finGestion ?? row.fechaFin),
        activo: Boolean(row.periodoActivo),
        estado: row.periodoEstado,
      }
      : null,
  });
}

async function assertEditableCursoPeriodo(id: string): Promise<{ periodoId: string }> {
  const result = await query<{ periodoId: bigint; periodoActivo: boolean; periodoEstado: string; cursoEstado: string }>(
    `SELECT cp.periodo_id AS "periodoId", p.activo AS "periodoActivo",
       p.estado AS "periodoEstado", cp.estado AS "cursoEstado"
     FROM cursos_periodo cp
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [id],
  );
  if (!result.rows.length) throw new HttpError(404, `Curso del periodo id=${id} no encontrado`);
  const row = result.rows[0];
  if (row.periodoActivo || !["configuracion", "borrador"].includes(row.periodoEstado) || row.cursoEstado !== "activo") {
    throw new HttpError(409, "El curso pertenece a una gestión que ya no puede editarse");
  }
  return { periodoId: toId(row.periodoId) };
}

async function assertEditablePeriodoTx(tx: Transaction, periodoId: string): Promise<void> {
  const result = await tx.queryObject<{ activo: boolean; estado: string }>(
    `SELECT activo, estado FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
    [periodoId],
  );
  if (!result.rows.length || result.rows[0].activo || !["configuracion", "borrador"].includes(result.rows[0].estado)) {
    throw new HttpError(409, "La gestión ya no puede editarse");
  }
}

async function assertEditableCursoPeriodoTx(tx: Transaction, id: string): Promise<string> {
  const result = await tx.queryObject<{ periodoId: bigint; periodoActivo: boolean; periodoEstado: string; estado: string; cursoActivo: boolean }>(
    `SELECT cp.periodo_id AS "periodoId", p.activo AS "periodoActivo",
       p.estado AS "periodoEstado", cp.estado, c.activo AS "cursoActivo"
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1
     FOR UPDATE OF p, cp`,
    [id],
  );
  if (!result.rows.length) throw new HttpError(404, `Curso del periodo id=${id} no encontrado`);
  const row = result.rows[0];
  if (row.periodoActivo || !["configuracion", "borrador"].includes(row.periodoEstado) || row.estado !== "activo" || !row.cursoActivo) {
    throw new HttpError(409, "El curso pertenece a una gestión que ya no puede editarse");
  }
  return toId(row.periodoId);
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
    cp.turno_id AS "turnoId",
    t.codigo AS "turnoCodigo",
    t.nombre AS "turnoNombre",
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
    p.inicio_gestion AS "inicioGestion",
    p.fin_gestion AS "finGestion",
    p.activo AS "periodoActivo",
    p.estado AS "periodoEstado",
    (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo') AS "totalInscritos"
  FROM cursos_periodo cp
  JOIN cursos c ON c.id = cp.curso_id
  JOIN turnos t ON t.id = cp.turno_id
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
    query<{ id: bigint; capacidad_maxima: number; activo: boolean }>(`SELECT id, capacidad_maxima, activo FROM cursos WHERE id = $1`, [cursoId]),
    query<{ id: bigint; activo: boolean; estado: string }>(`SELECT id, activo, estado FROM periodos_academicos WHERE id = $1`, [periodoId]),
  ]);

  if (cursoRes.rows.length === 0 || !cursoRes.rows[0].activo) throw new HttpError(404, `Curso id=${cursoId} no encontrado o inactivo`);
  if (periodoRes.rows.length === 0) throw new HttpError(404, `Periodo id=${periodoId} no encontrado`);
  if (periodoRes.rows[0].activo || !["configuracion", "borrador"].includes(periodoRes.rows[0].estado)) {
    throw new HttpError(409, "Los cursos se crean únicamente durante la configuración de la gestión");
  }

  const capacidad = Number(input.capacidadMaxima ?? cursoRes.rows[0].capacidad_maxima);
  if (!Number.isInteger(capacidad) || capacidad < 1) {
    throw new HttpError(400, "capacidadMaxima debe ser un entero mayor a 0");
  }

  const estado = input.estado ? parseEstado(input.estado) : "activo";

  const turnoId = input.turnoId ? String(input.turnoId) : null;
  if (turnoId && !/^\d+$/.test(turnoId)) throw new HttpError(400, "turnoId debe ser numérico");
  let effectiveTurnoId = turnoId;
  await query(
    `INSERT INTO turnos (codigo, nombre, hora_inicio, hora_fin, receso_inicio, receso_fin)
     VALUES
       ('manana', 'Turno Mañana', '07:00', '12:30', '09:30', '10:00'),
       ('tarde', 'Turno Tarde', '14:00', '18:30', '16:00', '16:30')
     ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre`,
  );
  if (!effectiveTurnoId) {
    const defaultTurno = await query<{ id: bigint }>(`SELECT id FROM turnos WHERE codigo = 'manana' LIMIT 1`);
    effectiveTurnoId = defaultTurno.rows[0] ? toId(defaultTurno.rows[0].id) : null;
  }
  if (effectiveTurnoId) {
    const turno = await query<{ id: bigint }>(`SELECT id FROM turnos WHERE id = $1 AND activo = true`, [effectiveTurnoId]);
    if (!turno.rows.length) throw new HttpError(400, "El turno seleccionado no está activo");
  }
  try {
    const newId = await sTransaction(async (tx) => {
      await assertEditablePeriodoTx(tx, periodoId);
      const res = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, turno_id, estado)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [cursoId, periodoId, capacidad, effectiveTurnoId, estado],
      );
      await tx.queryObject(`UPDATE periodos_academicos SET horarios_generados = false WHERE id = $1`, [periodoId]);
      return toId(res.rows[0].id);
    });
    return await getCursoPeriodoById(newId);
  } catch (err) {
    throw mapDbError(err, "Error al asociar curso con periodo académico");
  }
}

export async function updateCursoPeriodo(id: string, input: UpdateCursoPeriodoInput): Promise<CursoPeriodo> {
  await assertEditableCursoPeriodo(id);
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
  if (input.turnoId !== undefined) {
    const turnoId = String(input.turnoId ?? "").trim();
    if (!/^\d+$/.test(turnoId)) throw new HttpError(400, "turnoId debe ser numérico");
    const turno = await query<{ id: bigint }>(`SELECT id FROM turnos WHERE id = $1 AND activo = true`, [turnoId]);
    if (!turno.rows.length) throw new HttpError(400, "El turno seleccionado no está activo");
    fields.push(`turno_id = $${idx++}`);
    params.push(turnoId);
  }
  if (input.estado !== undefined) {
    fields.push(`estado = $${idx++}`);
    params.push(parseEstado(input.estado));
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    await sTransaction(async (tx) => {
      await assertEditableCursoPeriodoTx(tx, id);
      params.push(id);
      await tx.queryObject(`UPDATE cursos_periodo SET ${fields.join(", ")} WHERE id = $${idx}`, params);
      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = false
         WHERE id = (SELECT periodo_id FROM cursos_periodo WHERE id = $1)`,
        [id],
      );
    });
    return await getCursoPeriodoById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar curso del periodo");
  }
}

export async function deleteCursoPeriodo(id: string): Promise<void> {
  const current = await getCursoPeriodoById(id);
  await assertEditableCursoPeriodo(id);
  try {
    await sTransaction(async (tx) => {
      await assertEditableCursoPeriodoTx(tx, id);
      await tx.queryObject(`DELETE FROM cursos_periodo WHERE id = $1`, [id]);
      await tx.queryObject(`UPDATE periodos_academicos SET horarios_generados = false WHERE id = $1`, [current.periodoId]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al eliminar curso del periodo: existen inscripciones o asignaciones asociadas");
  }
}
