import { query } from "../connects/Database/transaction.ts";
import {
  AsignacionDocente,
  CreateAsignacionInput,
  ESTADOS_ASIGNACION,
  EstadoAsignacion,
  PaginatedResult,
  PaginationQuery,
  UpdateAsignacionInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

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
        capacidadMaxima: 0,
        estado: "activo",
        curso: {
          id: toId(row.cursoId),
          nivel: row.nivel ?? "",
          grado: row.grado ?? "",
          paralelo: row.paralelo ?? "",
          capacidadMaxima: 0,
          activo: true,
        },
        periodo: {
          id: toId(row.periodoId!),
          anio: Number(row.anio ?? 0),
          nombre: row.periodoNombre ?? "",
          fechaInicio: "",
          fechaFin: "",
          activo: true,
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

async function resolveMaestroId(input: string): Promise<string> {
  const res = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
    [input],
  );
  if (res.rows.length === 0) {
    throw new HttpError(404, `Maestro id=${input} no encontrado`);
  }
  return toId(res.rows[0].id);
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
    c.nivel,
    c.grado,
    c.paralelo,
    p.anio,
    p.nombre AS "periodoNombre"
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
  },
): Promise<PaginatedResult<AsignacionDocente>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.maestroId) {
    if (!/^\d+$/.test(filters.maestroId)) throw new HttpError(400, "maestroId debe ser numérico");
    conditions.push(`(ad.maestro_id = $${idx} OR m.usuario_id = $${idx})`);
    params.push(filters.maestroId);
    idx++;
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

export async function getAsignacionById(id: string): Promise<AsignacionDocente> {
  const res = await query<AsignacionRow>(`${SELECT} WHERE ad.id = $1`, [id]);
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

  const [materiaRes, cpRes] = await Promise.all([
    query<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1`, [materiaId]),
    query<{ id: bigint }>(`SELECT id FROM cursos_periodo WHERE id = $1`, [cpId]),
  ]);

  if (materiaRes.rows.length === 0) throw new HttpError(404, `Materia id=${materiaId} no encontrada`);
  if (cpRes.rows.length === 0) throw new HttpError(404, `Curso-Periodo id=${cpId} no encontrado`);

  const estado = input.estado ? parseEstado(input.estado) : "activo";

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [maestroId, materiaId, cpId, estado],
    );
    return await getAsignacionById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al crear la asignación docente (posible asignación duplicada)");
  }
}

export async function updateAsignacion(id: string, input: UpdateAsignacionInput): Promise<AsignacionDocente> {
  await getAsignacionById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.maestroId !== undefined) {
    const maestroId = await resolveMaestroId(String(input.maestroId));
    fields.push(`maestro_id = $${idx++}`);
    params.push(maestroId);
  }
  if (input.materiaId !== undefined) {
    const matId = String(input.materiaId);
    if (!/^\d+$/.test(matId)) throw new HttpError(400, "materiaId debe ser numérico");
    fields.push(`materia_id = $${idx++}`);
    params.push(matId);
  }
  if (input.cursoPeriodoId !== undefined) {
    const cpId = String(input.cursoPeriodoId);
    if (!/^\d+$/.test(cpId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    fields.push(`curso_periodo_id = $${idx++}`);
    params.push(cpId);
  }
  if (input.estado !== undefined) {
    const estado = parseEstado(input.estado);
    fields.push(`estado = $${idx++}`);
    params.push(estado);
    if (estado === "finalizado" || estado === "cancelado") {
      fields.push(`fecha_finalizacion = NOW()`);
    } else {
      fields.push(`fecha_finalizacion = NULL`);
    }
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    await query(`UPDATE asignaciones_docentes SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getAsignacionById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar la asignación docente");
  }
}

export async function deleteAsignacion(id: string): Promise<void> {
  await getAsignacionById(id);
  try {
    await query(`DELETE FROM asignaciones_docentes WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar la asignación docente: tiene materiales, tareas o asistencias asociadas");
  }
}
