import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreatePeriodoInput,
  PaginatedResult,
  PaginationQuery,
  PeriodoAcademico,
  UpdatePeriodoInput,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";
import { isIsoDate } from "../utils/http.ts";

interface PeriodoRow {
  id: bigint;
  anio: number;
  nombre: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  activo: boolean;
  fechaCreacion: Date | string;
}

function mapPeriodo(row: PeriodoRow): PeriodoAcademico {
  return serialize({
    id: toId(row.id),
    anio: Number(row.anio),
    nombre: row.nombre,
    fechaInicio: asDateString(row.fechaInicio),
    fechaFin: asDateString(row.fechaFin),
    activo: Boolean(row.activo),
    fechaCreacion: asDateString(row.fechaCreacion),
  });
}

function validatePeriodo(input: CreatePeriodoInput | UpdatePeriodoInput, partial = false): void {
  if (!partial || input.anio !== undefined) {
    const anio = Number(input.anio);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      throw new HttpError(400, "anio debe ser un entero entre 2000 y 2100");
    }
  }
  if (!partial || input.nombre !== undefined) {
    if (!String(input.nombre ?? "").trim()) {
      throw new HttpError(400, "nombre es obligatorio");
    }
  }
  if (!partial || input.fechaInicio !== undefined) {
    if (!isIsoDate(input.fechaInicio)) {
      throw new HttpError(400, "fechaInicio debe tener formato YYYY-MM-DD");
    }
  }
  if (!partial || input.fechaFin !== undefined) {
    if (!isIsoDate(input.fechaFin)) {
      throw new HttpError(400, "fechaFin debe tener formato YYYY-MM-DD");
    }
  }
}

function assertDateRange(inicio: string, fin: string): void {
  if (new Date(fin) < new Date(inicio)) {
    throw new HttpError(400, "fechaFin no puede ser anterior a fechaInicio");
  }
}

const SELECT = `
  SELECT
    id,
    anio,
    nombre,
    fecha_inicio AS "fechaInicio",
    fecha_fin AS "fechaFin",
    activo,
    fecha_creacion AS "fechaCreacion"
  FROM periodos_academicos
`;

export async function listPeriodos(
  pagination: PaginationQuery,
  filters: { anio?: string; activo?: string; buscar?: string },
): Promise<PaginatedResult<PeriodoAcademico>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.anio) {
    if (!/^\d+$/.test(filters.anio)) throw new HttpError(400, "anio debe ser numérico");
    conditions.push(`anio = $${idx++}`);
    params.push(Number(filters.anio));
  }
  if (filters.activo === "true" || filters.activo === "false") {
    conditions.push(`activo = $${idx++}`);
    params.push(filters.activo === "true");
  }
  if (filters.buscar) {
    conditions.push(`nombre ILIKE $${idx++}`);
    params.push(`%${filters.buscar}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<PeriodoRow>(
        `${SELECT} ${where} ORDER BY anio DESC, fecha_inicio DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM periodos_academicos ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapPeriodo),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar periodos académicos");
  }
}

export async function getPeriodoById(id: string): Promise<PeriodoAcademico> {
  const res = await query<PeriodoRow>(`${SELECT} WHERE id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Periodo académico id=${id} no encontrado`);
  }
  return mapPeriodo(res.rows[0]);
}

export async function createPeriodo(input: CreatePeriodoInput): Promise<PeriodoAcademico> {
  validatePeriodo(input);
  const nombre = String(input.nombre).trim();
  assertDateRange(input.fechaInicio, input.fechaFin);
  const activar = Boolean(input.activo);

  try {
    return await sTransaction(async (tx) => {
      if (activar) {
        await tx.queryObject(`UPDATE periodos_academicos SET activo = false WHERE activo = true`);
      }
      const res = await tx.queryObject<PeriodoRow>(
        `INSERT INTO periodos_academicos (anio, nombre, fecha_inicio, fecha_fin, activo)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
           id, anio, nombre,
           fecha_inicio AS "fechaInicio",
           fecha_fin AS "fechaFin",
           activo,
           fecha_creacion AS "fechaCreacion"`,
        [input.anio, nombre, input.fechaInicio, input.fechaFin, activar],
      );
      const periodoCreado = res.rows[0];

      // Poblado automático: instanciar todos los cursos base activos en cursos_periodo para este nuevo periodo
      await tx.queryObject(
        `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, estado)
         SELECT id, $1, COALESCE(capacidad_maxima, 35), 'activo'
         FROM cursos
         WHERE activo = true
         ON CONFLICT (curso_id, periodo_id) DO NOTHING`,
        [periodoCreado.id],
      );

      return mapPeriodo(periodoCreado);
    });
  } catch (err) {
    throw mapDbError(err, "Error al crear el periodo académico");
  }
}

export async function updatePeriodo(id: string, input: UpdatePeriodoInput): Promise<PeriodoAcademico> {
  await getPeriodoById(id);
  validatePeriodo(input, true);

  const current = await getPeriodoById(id);
  const fechaInicio = input.fechaInicio ?? current.fechaInicio;
  const fechaFin = input.fechaFin ?? current.fechaFin;
  assertDateRange(fechaInicio, fechaFin);

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.anio !== undefined) {
    fields.push(`anio = $${idx++}`);
    params.push(Number(input.anio));
  }
  if (input.nombre !== undefined) {
    fields.push(`nombre = $${idx++}`);
    params.push(String(input.nombre).trim());
  }
  if (input.fechaInicio !== undefined) {
    fields.push(`fecha_inicio = $${idx++}`);
    params.push(input.fechaInicio);
  }
  if (input.fechaFin !== undefined) {
    fields.push(`fecha_fin = $${idx++}`);
    params.push(input.fechaFin);
  }
  if (input.activo !== undefined) {
    fields.push(`activo = $${idx++}`);
    params.push(Boolean(input.activo));
  }

  if (fields.length === 0) {
    throw new HttpError(400, "No hay campos para actualizar");
  }

  try {
    return await sTransaction(async (tx) => {
      if (input.activo === true) {
        await tx.queryObject(
          `UPDATE periodos_academicos SET activo = false WHERE activo = true AND id <> $1`,
          [id],
        );
      }
      params.push(id);
      const res = await tx.queryObject<PeriodoRow>(
        `UPDATE periodos_academicos SET ${fields.join(", ")}
         WHERE id = $${idx}
         RETURNING
           id, anio, nombre,
           fecha_inicio AS "fechaInicio",
           fecha_fin AS "fechaFin",
           activo,
           fecha_creacion AS "fechaCreacion"`,
        params,
      );
      return mapPeriodo(res.rows[0]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al actualizar el periodo académico");
  }
}

export async function deletePeriodo(id: string): Promise<void> {
  await getPeriodoById(id);
  try {
    await query(`DELETE FROM periodos_academicos WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar el periodo académico");
  }
}

export async function checkAndDeactivateExpiredPeriodos(): Promise<number> {
  try {
    const res = await query<{ count: string }>(
      `WITH expired AS (
         UPDATE periodos_academicos
         SET activo = false
         WHERE activo = true AND fecha_fin < CURRENT_DATE
         RETURNING id
       )
       SELECT COUNT(*) AS count FROM expired`
    );
    const deactivated = Number(res.rows[0]?.count ?? 0);
    if (deactivated > 0) {
      console.log(`[periodos] Tarea programada: Se desactivaron ${deactivated} período(s) académico(s) cuya fecha fin expiró.`);
    }
    return deactivated;
  } catch (err) {
    console.error("[periodos] Error en verificación de periodos expirados:", err);
    return 0;
  }
}

