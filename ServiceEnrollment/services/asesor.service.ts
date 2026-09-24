import type { Transaction } from "@db/postgres";
import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreateCursoAsesorInput,
  CursoAsesor,
  EstadoCursoPeriodo,
  PaginatedResult,
  PaginationQuery,
  UpdateCursoAsesorInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";

interface AsesorRow {
  id: bigint;
  cursoPeriodoId: bigint;
  maestroId: bigint;
  fechaInicio: Date | string;
  fechaFin: Date | string | null;
  // Maestro info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  // Curso Periodo info
  cursoId?: bigint;
  periodoId?: bigint;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  anio?: number;
  periodoNombre?: string;
  cursoEstado?: EstadoCursoPeriodo;
  cursoCapacidad?: number;
  cursoActivo?: boolean;
  periodoActivo?: boolean;
  periodoEstado?: string;
  periodoInicio?: Date | string;
  periodoFin?: Date | string;
  periodoInicioGestion?: Date | string;
  periodoFinGestion?: Date | string;
}

function mapAsesor(row: AsesorRow): CursoAsesor {
  return serialize({
    id: toId(row.id),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    maestroId: toId(row.maestroId),
    fechaInicio: asDateString(row.fechaInicio),
    fechaFin: row.fechaFin ? asDateString(row.fechaFin) : null,
    maestro: row.usuarioId
      ? {
        id: toId(row.maestroId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      }
      : null,
    cursoPeriodo: row.cursoId
      ? {
        id: toId(row.cursoPeriodoId),
        cursoId: toId(row.cursoId),
        periodoId: toId(row.periodoId!),
        capacidadMaxima: Number(row.cursoCapacidad ?? 0),
        estado: row.cursoEstado ?? "activo",
        curso: {
          id: toId(row.cursoId),
          nivel: row.nivel ?? "",
          grado: row.grado ?? "",
          paralelo: row.paralelo ?? "",
          capacidadMaxima: Number(row.cursoCapacidad ?? 0),
          activo: Boolean(row.cursoActivo),
        },
        periodo: {
          id: toId(row.periodoId!),
          anio: Number(row.anio ?? 0),
          nombre: row.periodoNombre ?? "",
          fechaInicio: asDateString(row.periodoInicio),
          fechaFin: asDateString(row.periodoFin),
          inicioGestion: asDateString(row.periodoInicioGestion ?? row.periodoInicio),
          finGestion: asDateString(row.periodoFinGestion ?? row.periodoFin),
          activo: Boolean(row.periodoActivo),
          estado: row.periodoEstado,
        },
      }
      : null,
  });
}

async function assertEditableCoursePeriodoTx(tx: Transaction, cursoPeriodoId: string, allowActive = false): Promise<void> {
  const result = await tx.queryObject<{ periodoActivo: boolean; periodoEstado: string; estado: string; cursoActivo: boolean }>(
    `SELECT p.activo AS "periodoActivo", p.estado AS "periodoEstado", cp.estado,
       c.activo AS "cursoActivo"
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1
     FOR UPDATE OF p, cp`,
    [cursoPeriodoId],
  );
  if (!result.rows.length) throw new HttpError(404, `Curso-Periodo id=${cursoPeriodoId} no encontrado`);
  const row = result.rows[0];
  if ((!allowActive && row.periodoActivo) || (!["configuracion", "borrador", "activo"].includes(row.periodoEstado)) || row.estado !== "activo" || !row.cursoActivo) {
    throw new HttpError(409, "La asignación pertenece a una gestión que ya no puede editarse");
  }
}
async function resolveMaestroId(input: string): Promise<string> {
  const byUser = await query<{ id: bigint }>(`SELECT id FROM maestros WHERE usuario_id = $1 LIMIT 1`, [input]);
  if (byUser.rows.length) return toId(byUser.rows[0].id);
  const byDomainId = await query<{ id: bigint }>(`SELECT id FROM maestros WHERE id = $1 LIMIT 1`, [input]);
  if (byDomainId.rows.length === 0) {
    throw new HttpError(404, `Maestro id=${input} no encontrado`);
  }
  return toId(byDomainId.rows[0].id);
}

async function assertEditableCoursePeriodo(cursoPeriodoId: string, allowActive = false): Promise<void> {
  const result = await query<{ periodoActivo: boolean; periodoEstado: string; estado: string; cursoActivo: boolean }>(
    `SELECT p.activo AS "periodoActivo", p.estado AS "periodoEstado", cp.estado,
       c.activo AS "cursoActivo"
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [cursoPeriodoId],
  );
  if (!result.rows.length) throw new HttpError(404, `Curso-Periodo id=${cursoPeriodoId} no encontrado`);
  const row = result.rows[0];
  if ((!allowActive && row.periodoActivo) || (!["configuracion", "borrador", "activo"].includes(row.periodoEstado)) || row.estado !== "activo" || !row.cursoActivo) {
    throw new HttpError(409, "El asesor pertenece a una gestión que ya no puede editarse");
  }
}

const SELECT = `
  SELECT
    ca.id,
    ca.curso_periodo_id AS "cursoPeriodoId",
    ca.maestro_id AS "maestroId",
    ca.fecha_inicio AS "fechaInicio",
    ca.fecha_fin AS "fechaFin",
    m.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    cp.curso_id AS "cursoId",
    cp.periodo_id AS "periodoId",
    cp.capacidad_maxima AS "cursoCapacidad",
    cp.estado AS "cursoEstado",
    c.activo AS "cursoActivo",
    c.nivel,
    c.grado,
    c.paralelo,
    p.anio,
    p.nombre AS "periodoNombre",
    p.fecha_inicio AS "periodoInicio",
    p.fecha_fin AS "periodoFin",
     p.inicio_gestion AS "periodoInicioGestion",
     p.fin_gestion AS "periodoFinGestion",
    p.activo AS "periodoActivo",
    p.estado AS "periodoEstado"
  FROM curso_asesor ca
  JOIN maestros m ON m.id = ca.maestro_id
  JOIN usuarios u ON u.id = m.usuario_id
  JOIN cursos_periodo cp ON cp.id = ca.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  JOIN periodos_academicos p ON p.id = cp.periodo_id
`;

export async function listAsesores(
  pagination: PaginationQuery,
  filters: { cursoPeriodoId?: string; maestroId?: string; periodoId?: string; viewerUserId?: string; viewerRole?: string },
): Promise<PaginatedResult<CursoAsesor>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`ca.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.maestroId) {
    if (!/^\d+$/.test(filters.maestroId)) throw new HttpError(400, "maestroId debe ser numérico");
    const resolvedMaestroId = await resolveMaestroId(filters.maestroId);
    conditions.push(`ca.maestro_id = $${idx++}`);
    params.push(resolvedMaestroId);
  }
  if (filters.periodoId) {
    if (!/^\d+$/.test(filters.periodoId)) throw new HttpError(400, "periodoId debe ser numérico");
    conditions.push(`cp.periodo_id = $${idx++}`);
    params.push(filters.periodoId);
  }
  if (filters.viewerRole === "profesor" && filters.viewerUserId) {
    conditions.push(`m.usuario_id = $${idx++}`);
    params.push(filters.viewerUserId);
  } else if (filters.viewerRole === "estudiante" && filters.viewerUserId) {
    conditions.push(`EXISTS (
      SELECT 1 FROM inscripciones i
      JOIN estudiantes e ON e.id = i.estudiante_id
      WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo'
        AND (e.usuario_id = $${idx} OR EXISTS (
          SELECT 1 FROM estudiante_apoderado ea
          JOIN apoderados a ON a.id = ea.apoderado_id
          WHERE ea.estudiante_id = e.id AND a.usuario_id = $${idx}
        ))
    )`);
    params.push(filters.viewerUserId);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<AsesorRow>(
        `${SELECT} ${where} ORDER BY p.anio DESC, c.nivel, c.grado, c.paralelo LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM curso_asesor ca
         JOIN maestros m ON m.id = ca.maestro_id
         JOIN cursos_periodo cp ON cp.id = ca.curso_periodo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapAsesor),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar asesores de curso");
  }
}

export async function getAsesorById(id: string, viewerUserId?: string, viewerRole?: string): Promise<CursoAsesor> {
  const scope = viewerRole === "profesor" && viewerUserId
    ? ` AND m.usuario_id = $2`
    : viewerRole === "estudiante" && viewerUserId
    ? ` AND EXISTS (
        SELECT 1 FROM inscripciones i
        JOIN estudiantes e ON e.id = i.estudiante_id
        WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo'
          AND (e.usuario_id = $2 OR EXISTS (
            SELECT 1 FROM estudiante_apoderado ea
            JOIN apoderados a ON a.id = ea.apoderado_id
            WHERE ea.estudiante_id = e.id AND a.usuario_id = $2
          ))
      )`
    : "";
  const res = await query<AsesorRow>(`${SELECT} WHERE ca.id = $1${scope}`, scope ? [id, viewerUserId] : [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Asignación de asesor id=${id} no encontrada`);
  }
  return mapAsesor(res.rows[0]);
}

export async function createAsesor(input: CreateCursoAsesorInput): Promise<CursoAsesor> {
  const cpId = String(input.cursoPeriodoId ?? "").trim();
  const maestroInput = String(input.maestroId ?? "").trim();
  if (!/^\d+$/.test(cpId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
  if (!/^\d+$/.test(maestroInput)) throw new HttpError(400, "maestroId debe ser numérico");

  const maestroId = await resolveMaestroId(maestroInput);

  const cpRes = await query<{
    id: bigint;
    estado: string;
    periodoInicio: Date | string;
    periodoFin: Date | string;
  }>(
    `SELECT cp.id, cp.estado,
            p.inicio_gestion AS "periodoInicio", p.fin_gestion AS "periodoFin"
     FROM cursos_periodo cp
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [cpId],
  );
  if (cpRes.rows.length === 0) throw new HttpError(404, `Curso-Periodo id=${cpId} no encontrado`);
  const fechaInicio = asDateString(cpRes.rows[0].periodoInicio);
  const fechaFin = asDateString(cpRes.rows[0].periodoFin);
  await assertEditableCoursePeriodo(cpId, true);
  const maestro = await query<{ estado: string }>(`SELECT estado FROM maestros WHERE id = $1`, [maestroId]);
  if (!maestro.rows.length || maestro.rows[0].estado !== "activo") throw new HttpError(409, "El asesor no está activo");

  // Verificar si ya cuenta con asesor asignado
  const existingRes = await query<{ id: bigint }>(
    `SELECT id FROM curso_asesor WHERE curso_periodo_id = $1`,
    [cpId],
  );
  if (existingRes.rows.length > 0) {
    throw new HttpError(409, "El curso seleccionado ya cuenta con un maestro asesor asignado");
  }

  try {
    const newId = await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, cpId, true);
      const res = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO curso_asesor (curso_periodo_id, maestro_id, fecha_inicio, fecha_fin)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [cpId, maestroId, fechaInicio, fechaFin],
      );
      return toId(res.rows[0].id);
    });
    return await getAsesorById(newId);
  } catch (err) {
    throw mapDbError(err, "Error al asignar asesor de curso");
  }
}

export async function updateAsesor(id: string, input: UpdateCursoAsesorInput): Promise<CursoAsesor> {
  const current = await getAsesorById(id);
  await assertEditableCoursePeriodo(current.cursoPeriodoId, true);
  const periodRes = await query<{ inicio: Date | string; fin: Date | string }>(
    `SELECT p.inicio_gestion AS inicio, p.fin_gestion AS fin
     FROM cursos_periodo cp
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [current.cursoPeriodoId],
  );
  if (!periodRes.rows.length) throw new HttpError(404, "La gestión del asesor no existe");
  const derivedInicio = asDateString(periodRes.rows[0].inicio);
  const derivedFin = asDateString(periodRes.rows[0].fin);
  const fields: string[] = []
  const params: unknown[] = [];
  let idx = 1;

  if (input.maestroId !== undefined) {
    const maestroId = await resolveMaestroId(String(input.maestroId));
    const maestro = await query<{ estado: string }>(`SELECT estado FROM maestros WHERE id = $1`, [maestroId]);
    if (!maestro.rows.length || maestro.rows[0].estado !== "activo") throw new HttpError(409, "El asesor no está activo");
    fields.push(`maestro_id = $${idx++}`);
    params.push(maestroId);
  }
  // Las fechas del asesor se derivan de la gestión; el cliente no puede ampliarlas.
  fields.push(`fecha_inicio = $${idx++}`, `fecha_fin = $${idx++}`);
  params.push(derivedInicio, derivedFin);
  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, current.cursoPeriodoId, true);
      params.push(id);
      await tx.queryObject(`UPDATE curso_asesor SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    });
    return await getAsesorById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar asignación de asesor");
  }
}

export async function deleteAsesor(id: string): Promise<void> {
  const current = await getAsesorById(id);
  await assertEditableCoursePeriodo(current.cursoPeriodoId, true);
  try {
    await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, current.cursoPeriodoId, true);
      await tx.queryObject(`DELETE FROM curso_asesor WHERE id = $1`, [id]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al remover asignación de asesor");
  }
}
