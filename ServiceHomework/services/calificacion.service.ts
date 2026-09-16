import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  BulkCalificacionInput,
  Calificacion,
  CreateCalificacionInput,
  PaginatedResult,
  PaginationQuery,
  UpdateCalificacionInput,
} from "../models/homework.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface CalificacionRow {
  id: bigint;
  encargoId: bigint;
  estudianteId: bigint;
  nota: string | number;
  observacion?: string | null;
  fechaCalificacion: Date | string;
  fechaActualizacion: Date | string;
  // Estudiante info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  // Encargo info
  titulo?: string;
  tipo?: string;
  ponderacion?: string | number;
}

function mapCalificacion(row: CalificacionRow): Calificacion {
  return serialize({
    id: toId(row.id),
    encargoId: toId(row.encargoId),
    estudianteId: toId(row.estudianteId),
    nota: Number(row.nota),
    observacion: row.observacion,
    fechaCalificacion: asDateTimeString(row.fechaCalificacion),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
        numeroDoc: row.numeroDoc,
      }
      : null,
    encargo: row.titulo
      ? {
        id: toId(row.encargoId),
        titulo: row.titulo,
        tipo: row.tipo ?? "",
        ponderacion: Number(row.ponderacion ?? 0),
      }
      : null,
  });
}

const SELECT = `
  SELECT
    c.id,
    c.encargo_id AS "encargoId",
    c.estudiante_id AS "estudianteId",
    c.nota,
    c.observacion,
    c.fecha_calificacion AS "fechaCalificacion",
    c.fecha_actualizacion AS "fechaActualizacion",
    e.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    ud.numero_doc AS "numeroDoc",
    enc.titulo,
    enc.tipo,
    enc.ponderacion
  FROM calificaciones c
  JOIN estudiantes e ON e.id = c.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
  LEFT JOIN usuario_documentos ud ON ud.usuario_id = u.id AND ud.es_principal = true
  JOIN encargos enc ON enc.id = c.encargo_id
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

export async function listCalificaciones(
  pagination: PaginationQuery,
  filters: { encargoId?: string; estudianteId?: string; asignacionId?: string },
): Promise<PaginatedResult<Calificacion>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.encargoId) {
    if (!/^\d+$/.test(filters.encargoId)) throw new HttpError(400, "encargoId debe ser numérico");
    conditions.push(`c.encargo_id = $${idx++}`);
    params.push(filters.encargoId);
  }
  if (filters.estudianteId) {
    if (!/^\d+$/.test(filters.estudianteId)) throw new HttpError(400, "estudianteId debe ser numérico");
    conditions.push(`(c.estudiante_id = $${idx} OR e.usuario_id = $${idx})`);
    params.push(filters.estudianteId);
    idx++;
  }
  if (filters.asignacionId) {
    if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId debe ser numérico");
    conditions.push(`enc.asignacion_id = $${idx++}`);
    params.push(filters.asignacionId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<CalificacionRow>(
        `${SELECT} ${where} ORDER BY u.apellido_paterno, u.apellido_materno, u.nombre LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM calificaciones c
         JOIN estudiantes e ON e.id = c.estudiante_id
         JOIN encargos enc ON enc.id = c.encargo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapCalificacion),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar calificaciones");
  }
}

export async function getCalificacionById(id: string): Promise<Calificacion> {
  const res = await query<CalificacionRow>(`${SELECT} WHERE c.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Calificación id=${id} no encontrada`);
  }
  return mapCalificacion(res.rows[0]);
}

export async function createCalificacion(input: CreateCalificacionInput): Promise<Calificacion> {
  const encId = String(input.encargoId ?? "").trim();
  const estInput = String(input.estudianteId ?? "").trim();
  if (!/^\d+$/.test(encId)) throw new HttpError(400, "encargoId debe ser numérico");
  if (!/^\d+$/.test(estInput)) throw new HttpError(400, "estudianteId debe ser numérico");

  const nota = Number(input.nota);
  if (isNaN(nota) || nota < 0 || nota > 100) {
    throw new HttpError(400, "nota debe ser un número entre 0 y 100");
  }

  const estudianteId = await resolveEstudianteId(estInput);

  const encRes = await query<{ id: bigint }>(
    `SELECT id FROM encargos WHERE id = $1`,
    [encId],
  );
  if (encRes.rows.length === 0) throw new HttpError(404, `Encargo id=${encId} no encontrado`);

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO calificaciones (encargo_id, estudiante_id, nota, observacion)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [encId, estudianteId, nota, input.observacion?.trim() ?? null],
    );
    return await getCalificacionById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al registrar calificación");
  }
}

export async function updateCalificacion(id: string, input: UpdateCalificacionInput): Promise<Calificacion> {
  await getCalificacionById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.nota !== undefined) {
    const nota = Number(input.nota);
    if (isNaN(nota) || nota < 0 || nota > 100) {
      throw new HttpError(400, "nota debe ser un número entre 0 y 100");
    }
    fields.push(`nota = $${idx++}`);
    params.push(nota);
  }
  if (input.observacion !== undefined) {
    fields.push(`observacion = $${idx++}`);
    params.push(input.observacion?.trim() ?? null);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  fields.push(`fecha_actualizacion = CURRENT_TIMESTAMP`);

  try {
    params.push(id);
    await query(`UPDATE calificaciones SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getCalificacionById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar calificación");
  }
}

export async function deleteCalificacion(id: string): Promise<void> {
  await getCalificacionById(id);
  try {
    await query(`DELETE FROM calificaciones WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar calificación");
  }
}

export async function saveBulkCalificaciones(input: BulkCalificacionInput): Promise<{ totalGuardados: number }> {
  const encId = String(input.encargoId ?? "").trim();
  if (!/^\d+$/.test(encId)) throw new HttpError(400, "encargoId debe ser numérico");
  if (!Array.isArray(input.calificaciones) || input.calificaciones.length === 0) {
    throw new HttpError(400, "La lista de calificaciones no puede estar vacía");
  }

  const encRes = await query<{ id: bigint }>(`SELECT id FROM encargos WHERE id = $1`, [encId]);
  if (encRes.rows.length === 0) throw new HttpError(404, `Encargo id=${encId} no encontrado`);

  try {
    await sTransaction(async (client) => {
      for (const item of input.calificaciones) {
        const estId = String(item.estudianteId).trim();
        const nota = Number(item.nota);
        if (isNaN(nota) || nota < 0 || nota > 100) {
          throw new HttpError(400, `Nota inválida (${item.nota}) para el estudiante ${estId}`);
        }

        // Resuelve estudiante_id (puede ser id o usuario_id)
        const estRes = await client.queryObject<{ id: bigint }>(
          `SELECT id FROM estudiantes WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
          [estId],
        );
        if (estRes.rows.length === 0) continue;
        const realEstId = toId(estRes.rows[0].id);

        await client.queryObject(
          `INSERT INTO calificaciones (encargo_id, estudiante_id, nota, observacion)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (encargo_id, estudiante_id)
           DO UPDATE SET
             nota = EXCLUDED.nota,
             observacion = EXCLUDED.observacion,
             fecha_actualizacion = CURRENT_TIMESTAMP`,
          [encId, realEstId, nota, item.observacion?.trim() ?? null],
        );
      }
    });

    return { totalGuardados: input.calificaciones.length };
  } catch (err) {
    throw mapDbError(err, "Error al guardar calificaciones por lote");
  }
}
