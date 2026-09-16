import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  Asistencia,
  BulkAsistenciaInput,
  CreateAsistenciaInput,
  ESTADOS_ASISTENCIA,
  PaginatedResult,
  PaginationQuery,
  UpdateAsistenciaInput,
} from "../models/homework.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { isIsoDate } from "../utils/http.ts";

interface AsistenciaRow {
  id: bigint;
  estudianteId: bigint;
  asignacionId: bigint;
  fecha: Date | string;
  estado: string;
  justificacion?: string | null;
  fechaRegistro: Date | string;
  fechaActualizacion: Date | string;
  // Estudiante info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}

function mapAsistencia(row: AsistenciaRow): Asistencia {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    asignacionId: toId(row.asignacionId),
    fecha: asDateString(row.fecha),
    estado: row.estado as any,
    justificacion: row.justificacion,
    fechaRegistro: asDateTimeString(row.fechaRegistro),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      }
      : null,
  });
}

const SELECT = `
  SELECT
    a.id,
    a.estudiante_id AS "estudianteId",
    a.asignacion_id AS "asignacionId",
    a.fecha,
    a.estado,
    a.justificacion,
    a.fecha_registro AS "fechaRegistro",
    a.fecha_actualizacion AS "fechaActualizacion",
    e.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno"
  FROM asistencia a
  JOIN estudiantes e ON e.id = a.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
`;

async function resolveEstudianteId(input: string): Promise<string> {
  const res = await query<{ id: bigint }>(
    `SELECT id FROM estudiantes WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
    [input],
  );
  if (res.rows.length === 0) {
    throw new HttpError(404, `Estudiante id=${input} no encontrado`);
  }
  return toId(res.rows[0].id);
}

export async function listAsistencias(
  pagination: PaginationQuery,
  filters: { asignacionId?: string; estudianteId?: string; fecha?: string; estado?: string },
): Promise<PaginatedResult<Asistencia>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.asignacionId) {
    if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId debe ser numérico");
    conditions.push(`a.asignacion_id = $${idx++}`);
    params.push(filters.asignacionId);
  }
  if (filters.estudianteId) {
    if (!/^\d+$/.test(filters.estudianteId)) throw new HttpError(400, "estudianteId debe ser numérico");
    conditions.push(`(a.estudiante_id = $${idx} OR e.usuario_id = $${idx})`);
    params.push(filters.estudianteId);
    idx++;
  }
  if (filters.fecha) {
    if (!isIsoDate(filters.fecha)) throw new HttpError(400, "fecha debe tener formato YYYY-MM-DD");
    conditions.push(`a.fecha = $${idx++}`);
    params.push(filters.fecha);
  }
  if (filters.estado) {
    conditions.push(`a.estado = $${idx++}`);
    params.push(filters.estado);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<AsistenciaRow>(
        `${SELECT} ${where} ORDER BY a.fecha DESC, u.apellido_paterno, u.nombre LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM asistencia a
         JOIN estudiantes e ON e.id = a.estudiante_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapAsistencia),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar asistencia");
  }
}

export async function getAsistenciaById(id: string): Promise<Asistencia> {
  const res = await query<AsistenciaRow>(`${SELECT} WHERE a.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Registro de asistencia id=${id} no encontrado`);
  }
  return mapAsistencia(res.rows[0]);
}

export async function createAsistencia(input: CreateAsistenciaInput): Promise<Asistencia> {
  const asigId = String(input.asignacionId ?? "").trim();
  const estInput = String(input.estudianteId ?? "").trim();
  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!/^\d+$/.test(estInput)) throw new HttpError(400, "estudianteId debe ser numérico");

  if (!input.fecha || !isIsoDate(input.fecha)) {
    throw new HttpError(400, "fecha es obligatoria (formato YYYY-MM-DD)");
  }

  if (!ESTADOS_ASISTENCIA.includes(input.estado)) {
    throw new HttpError(400, `estado inválido. Opciones: ${ESTADOS_ASISTENCIA.join(", ")}`);
  }

  const estudianteId = await resolveEstudianteId(estInput);

  const asigRes = await query<{ id: bigint }>(
    `SELECT id FROM asignaciones_docentes WHERE id = $1`,
    [asigId],
  );
  if (asigRes.rows.length === 0) throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO asistencia (estudiante_id, asignacion_id, fecha, estado, justificacion)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (estudiante_id, asignacion_id, fecha)
       DO UPDATE SET
         estado = EXCLUDED.estado,
         justificacion = EXCLUDED.justificacion,
         fecha_actualizacion = CURRENT_TIMESTAMP
       RETURNING id`,
      [estudianteId, asigId, input.fecha, input.estado, input.justificacion?.trim() ?? null],
    );
    return await getAsistenciaById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al registrar asistencia");
  }
}

export async function updateAsistencia(id: string, input: UpdateAsistenciaInput): Promise<Asistencia> {
  await getAsistenciaById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.estado !== undefined) {
    if (!ESTADOS_ASISTENCIA.includes(input.estado)) {
      throw new HttpError(400, `estado inválido. Opciones: ${ESTADOS_ASISTENCIA.join(", ")}`);
    }
    fields.push(`estado = $${idx++}`);
    params.push(input.estado);
  }
  if (input.justificacion !== undefined) {
    fields.push(`justificacion = $${idx++}`);
    params.push(input.justificacion?.trim() ?? null);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  fields.push(`fecha_actualizacion = CURRENT_TIMESTAMP`);

  try {
    params.push(id);
    await query(`UPDATE asistencia SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getAsistenciaById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar asistencia");
  }
}

export async function deleteAsistencia(id: string): Promise<void> {
  await getAsistenciaById(id);
  try {
    await query(`DELETE FROM asistencia WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar asistencia");
  }
}

export async function saveBulkAsistencias(input: BulkAsistenciaInput): Promise<{ totalGuardados: number }> {
  const asigId = String(input.asignacionId ?? "").trim();
  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!input.fecha || !isIsoDate(input.fecha)) {
    throw new HttpError(400, "fecha es obligatoria (formato YYYY-MM-DD)");
  }
  if (!Array.isArray(input.asistencias) || input.asistencias.length === 0) {
    throw new HttpError(400, "La lista de asistencias no puede estar vacía");
  }

  const asigRes = await query<{ id: bigint }>(
    `SELECT id FROM asignaciones_docentes WHERE id = $1`,
    [asigId],
  );
  if (asigRes.rows.length === 0) throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);

  try {
    await sTransaction(async (client) => {
      for (const item of input.asistencias) {
        if (!ESTADOS_ASISTENCIA.includes(item.estado)) {
          throw new HttpError(400, `Estado '${item.estado}' inválido para el estudiante ${item.estudianteId}`);
        }
        const estId = String(item.estudianteId).trim();

        const estRes = await client.queryObject<{ id: bigint }>(
          `SELECT id FROM estudiantes WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
          [estId],
        );
        if (estRes.rows.length === 0) continue;
        const realEstId = toId(estRes.rows[0].id);

        await client.queryObject(
          `INSERT INTO asistencia (estudiante_id, asignacion_id, fecha, estado, justificacion)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (estudiante_id, asignacion_id, fecha)
           DO UPDATE SET
             estado = EXCLUDED.estado,
             justificacion = EXCLUDED.justificacion,
             fecha_actualizacion = CURRENT_TIMESTAMP`,
          [realEstId, asigId, input.fecha, item.estado, item.justificacion?.trim() ?? null],
        );
      }
    });

    return { totalGuardados: input.asistencias.length };
  } catch (err) {
    throw mapDbError(err, "Error al guardar asistencia por lote");
  }
}
