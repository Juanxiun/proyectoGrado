import type { Transaction } from "@db/postgres";
import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  AsignacionDocente,
  CreateAsignacionInput,
  ESTADOS_ASIGNACION,
  EstadoAsignacion,
  EstadoCursoPeriodo,
  PaginatedResult,
  PaginationQuery,
  UpdateAsignacionInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface AsignacionRow {
  id: bigint;
  maestroId: bigint;
  materiaId: bigint;
  cursoPeriodoId: bigint;
  estado: EstadoAsignacion;
  fechaAsignacion: Date | string;
  fechaFinalizacion: Date | string | null;
  // Maestro info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  especialidad?: string;
  // Materia info
  materiaCodigo?: string;
  materiaNombre?: string;
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
}

function mapAsignacion(row: AsignacionRow): AsignacionDocente {
  return serialize({
    id: toId(row.id),
    maestroId: toId(row.maestroId),
    materiaId: toId(row.materiaId),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    estado: row.estado,
    fechaAsignacion: asDateTimeString(row.fechaAsignacion) ?? "",
    fechaFinalizacion: asDateTimeString(row.fechaFinalizacion),
    maestro: row.usuarioId
      ? {
        id: toId(row.maestroId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
        especialidad: row.especialidad,
      }
      : null,
    materia: row.materiaNombre
      ? {
        id: toId(row.materiaId),
        codigo: row.materiaCodigo ?? "",
        nombre: row.materiaNombre,
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
          activo: Boolean(row.periodoActivo),
          estado: row.periodoEstado,
        },
      }
      : null,
  });
}

function parseEstado(value: unknown): EstadoAsignacion {
  const estado = String(value ?? "").trim().toLowerCase() as EstadoAsignacion;
  if (!ESTADOS_ASIGNACION.includes(estado)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS_ASIGNACION.join(", ")}`);
  }
  return estado;
}

async function assertEditableCoursePeriodo(cursoPeriodoId: string): Promise<void> {
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
  if (row.periodoActivo || !["configuracion", "borrador"].includes(row.periodoEstado) || row.estado !== "activo" || !row.cursoActivo) {
    throw new HttpError(409, "La asignación pertenece a una gestión que ya no puede editarse");
  }
}

async function assertEditableCoursePeriodoTx(tx: Transaction, cursoPeriodoId: string): Promise<void> {
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
  if (row.periodoActivo || !["configuracion", "borrador"].includes(row.periodoEstado) || row.estado !== "activo" || !row.cursoActivo) {
    throw new HttpError(409, "La asignación pertenece a una gestión que ya no puede editarse");
  }
}
async function resolveMaestroId(input: string): Promise<string> {
  const byUser = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE usuario_id = $1 LIMIT 1`,
    [input],
  );
  if (byUser.rows.length) return toId(byUser.rows[0].id);
  const byDomainId = await query<{ id: bigint }>(`SELECT id FROM maestros WHERE id = $1 LIMIT 1`, [input]);
  if (byDomainId.rows.length === 0) {
    throw new HttpError(404, `Maestro id=${input} no encontrado`);
  }
  return toId(byDomainId.rows[0].id);
}

const SELECT = `
  SELECT
    ad.id,
    ad.maestro_id AS "maestroId",
    ad.materia_id AS "materiaId",
    ad.curso_periodo_id AS "cursoPeriodoId",
    ad.estado,
    ad.fecha_asignacion AS "fechaAsignacion",
    ad.fecha_finalizacion AS "fechaFinalizacion",
    m.usuario_id AS "usuarioId",
    m.especialidad,
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    mat.codigo AS "materiaCodigo",
    mat.nombre AS "materiaNombre",
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
    p.activo AS "periodoActivo",
    p.estado AS "periodoEstado"
  FROM asignaciones_docentes ad
  JOIN maestros m ON m.id = ad.maestro_id
  JOIN usuarios u ON u.id = m.usuario_id
  JOIN materias mat ON mat.id = ad.materia_id
  JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  JOIN periodos_academicos p ON p.id = cp.periodo_id
`;

export async function listAsignaciones(
  pagination: PaginationQuery,
  filters: {
    maestroId?: string;
    materiaId?: string;
    cursoPeriodoId?: string;
    periodoId?: string;
    estado?: string;
    viewerUserId?: string;
    viewerRole?: string;
  },
): Promise<PaginatedResult<AsignacionDocente>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.maestroId) {
    if (!/^\d+$/.test(filters.maestroId)) throw new HttpError(400, "maestroId debe ser numérico");
    const resolvedMaestroId = await resolveMaestroId(filters.maestroId);
    conditions.push(`ad.maestro_id = $${idx++}`);
    params.push(resolvedMaestroId);
  }
  if (filters.materiaId) {
    if (!/^\d+$/.test(filters.materiaId)) throw new HttpError(400, "materiaId debe ser numérico");
    conditions.push(`ad.materia_id = $${idx++}`);
    params.push(filters.materiaId);
  }
  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`ad.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.periodoId) {
    if (!/^\d+$/.test(filters.periodoId)) throw new HttpError(400, "periodoId debe ser numérico");
    conditions.push(`cp.periodo_id = $${idx++}`);
    params.push(filters.periodoId);
  }
  if (filters.estado) {
    conditions.push(`ad.estado = $${idx++}`);
    params.push(parseEstado(filters.estado));
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
      query<AsignacionRow>(
        `${SELECT} ${where} ORDER BY p.anio DESC, c.nivel, c.grado, c.paralelo, mat.nombre LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM asignaciones_docentes ad
         JOIN maestros m ON m.id = ad.maestro_id
         JOIN materias mat ON mat.id = ad.materia_id
         JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapAsignacion),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar asignaciones docentes");
  }
}

export async function getAsignacionById(id: string, viewerUserId?: string, viewerRole?: string): Promise<AsignacionDocente> {
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
  const res = await query<AsignacionRow>(`${SELECT} WHERE ad.id = $1${scope}`, scope ? [id, viewerUserId] : [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Asignación docente id=${id} no encontrada`);
  }
  return mapAsignacion(res.rows[0]);
}

export async function createAsignacion(input: CreateAsignacionInput): Promise<AsignacionDocente> {
  const maestroInput = String(input.maestroId ?? "").trim();
  const materiaId = String(input.materiaId ?? "").trim();
  const cpId = String(input.cursoPeriodoId ?? "").trim();

  if (!/^\d+$/.test(maestroInput)) throw new HttpError(400, "maestroId debe ser numérico");
  if (!/^\d+$/.test(materiaId)) throw new HttpError(400, "materiaId debe ser numérico");
  if (!/^\d+$/.test(cpId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");

  const maestroId = await resolveMaestroId(maestroInput);

  const [materiaRes, cpRes, maestroRes] = await Promise.all([
    query<{ id: bigint; activo: boolean }>(`SELECT id, activo FROM materias WHERE id = $1`, [materiaId]),
    query<{ id: bigint }>(`SELECT id FROM cursos_periodo WHERE id = $1`, [cpId]),
    query<{ estado: string; materiasConfiguradas: boolean; materiaPermitida: boolean }>(
      `SELECT m.estado,
              COALESCE(m.materias_configuradas, false) AS "materiasConfiguradas",
              EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS "materiaPermitida"
       FROM maestros m WHERE m.id = $1`,
      [maestroId, materiaId],
    ),
  ]);

  if (materiaRes.rows.length === 0 || !materiaRes.rows[0].activo) throw new HttpError(404, `Materia id=${materiaId} no encontrada o inactiva`);
  if (cpRes.rows.length === 0) throw new HttpError(404, `Curso-Periodo id=${cpId} no encontrado`);
  if (maestroRes.rows.length === 0 || maestroRes.rows[0].estado !== "activo") throw new HttpError(409, "El docente no está activo");
  if (maestroRes.rows[0].materiasConfiguradas && !maestroRes.rows[0].materiaPermitida) {
    throw new HttpError(409, "El docente no está habilitado para impartir la materia seleccionada");
  }
  const mallaRes = await query<{ id: bigint }>(
    `SELECT mc.id
     FROM mallas_curriculares mc
     JOIN cursos_periodo cp ON cp.id = $2
     JOIN cursos c ON c.id = cp.curso_id
     WHERE mc.periodo_id = cp.periodo_id
       AND mc.nivel = c.nivel AND mc.grado = c.grado
       AND mc.materia_id = $1::bigint AND mc.activo = true
     LIMIT 1`,
    [materiaId, cpId],
  );
  if (!mallaRes.rows.length) throw new HttpError(409, "La materia no pertenece a la malla curricular del curso");
  await assertEditableCoursePeriodo(cpId);
  const existingAssignment = await query<{ id: bigint }>(
    `SELECT id FROM asignaciones_docentes
     WHERE curso_periodo_id = $1 AND materia_id = $2 AND estado = 'activo'
     LIMIT 1`,
    [cpId, materiaId],
  );
  if (existingAssignment.rows.length) {
    throw new HttpError(409, "La materia ya tiene un docente activo en este curso");
  }

  const estado = input.estado ? parseEstado(input.estado) : "activo";

  try {
    const newId = await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, cpId);
      const res = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [maestroId, materiaId, cpId, estado],
      );
      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = false
         WHERE id = (SELECT periodo_id FROM cursos_periodo WHERE id = $1)`,
        [cpId],
      );
      return toId(res.rows[0].id);
    });
    return await getAsignacionById(newId);
  } catch (err) {
    throw mapDbError(err, "Error al crear la asignación docente (posible asignación duplicada)");
  }
}

export async function updateAsignacion(id: string, input: UpdateAsignacionInput): Promise<AsignacionDocente> {
  const current = await getAsignacionById(id);
  await assertEditableCoursePeriodo(current.cursoPeriodoId);
  const fields: string[] = []
  const params: unknown[] = [];
  let idx = 1;

  if (input.maestroId !== undefined) {
    const maestroId = await resolveMaestroId(String(input.maestroId));
    const active = await query<{ estado: string }>(`SELECT estado FROM maestros WHERE id = $1`, [maestroId]);
    if (!active.rows.length || active.rows[0].estado !== "activo") throw new HttpError(409, "El docente no está activo");
    fields.push(`maestro_id = $${idx++}`);
    params.push(maestroId);
  }
  if (input.materiaId !== undefined) {
    const matId = String(input.materiaId);
    if (!/^\d+$/.test(matId)) throw new HttpError(400, "materiaId debe ser numérico");
    const materia = await query<{ activo: boolean }>(`SELECT activo FROM materias WHERE id = $1`, [matId]);
    if (!materia.rows.length || !materia.rows[0].activo) throw new HttpError(409, "La materia no está activa");
    fields.push(`materia_id = $${idx++}`);
    params.push(matId);
  }
  if (input.cursoPeriodoId !== undefined) {
    const cpId = String(input.cursoPeriodoId);
    if (!/^\d+$/.test(cpId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    await assertEditableCoursePeriodo(cpId);
    fields.push(`curso_periodo_id = $${idx++}`);
    params.push(cpId);
  }
  if (input.estado !== undefined) {
    const estado = parseEstado(input.estado);
    fields.push(`estado = $${idx++}`);
    params.push(estado);
    if (input.fechaFinalizacion === undefined) {
      fields.push(estado === "finalizado" || estado === "cancelado" ? `fecha_finalizacion = NOW()` : `fecha_finalizacion = NULL`);
    }
  }
  if (input.fechaFinalizacion !== undefined) {
    fields.push(`fecha_finalizacion = $${idx++}`);
    params.push(input.fechaFinalizacion ? new Date(input.fechaFinalizacion) : null);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");
  const targetCpId = input.cursoPeriodoId === undefined ? current.cursoPeriodoId : String(input.cursoPeriodoId);
  const targetMateriaId = input.materiaId === undefined ? current.materiaId : String(input.materiaId);
  const targetMaestroId = input.maestroId === undefined ? current.maestroId : await resolveMaestroId(String(input.maestroId));
  const targetCapability = await query<{ materiasConfiguradas: boolean; materiaPermitida: boolean }>(
    `SELECT COALESCE(m.materias_configuradas, false) AS \"materiasConfiguradas\",
            EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS \"materiaPermitida\"
     FROM maestros m WHERE m.id = $1`,
    [targetMaestroId, targetMateriaId],
  );
  if (targetCapability.rows[0]?.materiasConfiguradas && !targetCapability.rows[0].materiaPermitida) {
    throw new HttpError(409, "El docente no está habilitado para impartir la materia seleccionada");
  }
  const targetMalla = await query<{ id: bigint }>(
    `SELECT mc.id
     FROM mallas_curriculares mc
     JOIN cursos_periodo cp ON cp.id = $2
     JOIN cursos c ON c.id = cp.curso_id
     WHERE mc.periodo_id = cp.periodo_id
       AND mc.nivel = c.nivel AND mc.grado = c.grado
       AND mc.materia_id = $1::bigint AND mc.activo = true
     LIMIT 1`,
    [targetMateriaId, targetCpId],
  );
  if (!targetMalla.rows.length) throw new HttpError(409, "La materia no pertenece a la malla curricular del curso");

  try {
    await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, current.cursoPeriodoId);
      if (targetCpId !== current.cursoPeriodoId) await assertEditableCoursePeriodoTx(tx, targetCpId);
      const duplicate = await tx.queryObject<{ id: bigint }>(
        `SELECT id FROM asignaciones_docentes
         WHERE curso_periodo_id = $1 AND materia_id = $2 AND estado = 'activo' AND id <> $3
         LIMIT 1`,
        [targetCpId, targetMateriaId, id],
      );
      if (duplicate.rows.length) throw new HttpError(409, "La materia ya tiene un docente activo en este curso");
      params.push(id);
      await tx.queryObject(`UPDATE asignaciones_docentes SET ${fields.join(", ")} WHERE id = $${idx}`, params);
      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = false
         WHERE id = (SELECT periodo_id FROM cursos_periodo WHERE id = $1)`,
        [current.cursoPeriodoId],
      );
      if (targetCpId !== current.cursoPeriodoId) {
        await tx.queryObject(
          `UPDATE periodos_academicos SET horarios_generados = false
           WHERE id = (SELECT periodo_id FROM cursos_periodo WHERE id = $1)`,
          [targetCpId],
        );
      }
    });
    return await getAsignacionById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar la asignación docente");
  }
}

export async function deleteAsignacion(id: string): Promise<void> {
  const current = await getAsignacionById(id);
  await assertEditableCoursePeriodo(current.cursoPeriodoId);
  try {
    await sTransaction(async (tx) => {
      await assertEditableCoursePeriodoTx(tx, current.cursoPeriodoId);
      await tx.queryObject(`DELETE FROM asignaciones_docentes WHERE id = $1`, [id]);
      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = false
         WHERE id = (SELECT periodo_id FROM cursos_periodo WHERE id = $1)`,
        [current.cursoPeriodoId],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al eliminar la asignación docente: tiene materiales, tareas o asistencias asociadas");
  }
}
