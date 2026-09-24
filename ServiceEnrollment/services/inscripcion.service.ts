import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreateInscripcionInput,
  ESTADOS_INSCRIPCION,
  EstadoInscripcion,
  EstadoCursoPeriodo,
  Inscripcion,
  PaginatedResult,
  PaginationQuery,
  UpdateInscripcionInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface InscripcionRow {
  id: bigint;
  estudianteId: bigint;
  cursoPeriodoId: bigint;
  periodoId: bigint;
  origen: "nueva" | "reserva" | "promocion";
  fechaInscripcion: Date | string;
  fechaRetiro: Date | string | null;
  estado: EstadoInscripcion;
  observacion: string | null;
  // Estudiante info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  estudianteEstado?: string;
  // Curso Periodo info
  cursoId?: bigint;
  cursoPeriodoEstado?: EstadoCursoPeriodo;
  cursoActivo?: boolean;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  capacidadMaxima?: number;
  anio?: number;
  periodoNombre?: string;
  periodoInicio?: Date | string;
  periodoFin?: Date | string;
  periodoActivo?: boolean;
  periodoEstado?: string;
}

function mapInscripcion(row: InscripcionRow): Inscripcion {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    periodoId: toId(row.periodoId),
    origen: row.origen,
    fechaInscripcion: asDateTimeString(row.fechaInscripcion) ?? "",
    fechaRetiro: asDateTimeString(row.fechaRetiro),
    estado: row.estado,
    observacion: row.observacion,
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
        numeroDoc: row.numeroDoc,
        estado: row.estudianteEstado,
      }
      : null,
    cursoPeriodo: row.cursoId
      ? {
        id: toId(row.cursoPeriodoId),
        cursoId: toId(row.cursoId),
        periodoId: toId(row.periodoId!),
        capacidadMaxima: Number(row.capacidadMaxima ?? 0),
        estado: row.cursoPeriodoEstado ?? "activo",
        curso: {
          id: toId(row.cursoId),
          nivel: row.nivel ?? "",
          grado: row.grado ?? "",
          paralelo: row.paralelo ?? "",
          capacidadMaxima: Number(row.capacidadMaxima ?? 0),
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

function parseEstado(value: unknown): EstadoInscripcion {
  const estado = String(value ?? "").trim().toLowerCase() as EstadoInscripcion;
  if (!ESTADOS_INSCRIPCION.includes(estado)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS_INSCRIPCION.join(", ")}`);
  }
  return estado;
}

async function resolveEstudianteId(input: string): Promise<{ id: bigint; estado: string; usuario_id: bigint }> {
  let result = await query<{ id: bigint; estado: string; usuario_id: bigint }>(
    `SELECT id, estado, usuario_id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`,
    [input],
  );
  if (!result.rows.length) {
    result = await query<{ id: bigint; estado: string; usuario_id: bigint }>(
      `SELECT id, estado, usuario_id FROM estudiantes WHERE id = $1 LIMIT 1`,
      [input],
    );
  }
  if (!result.rows.length) throw new HttpError(404, `Estudiante id=${input} no encontrado`);
  return result.rows[0];
}

async function resolveEstudianteFilterId(input: string): Promise<string> {
  let result = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE id = $1 LIMIT 1`, [input]);
  if (!result.rows.length) {
    result = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`, [input]);
  }
  if (!result.rows.length) throw new HttpError(404, `Estudiante id=${input} no encontrado`);
  return toId(result.rows[0].id);
}
const SELECT = `
  SELECT
    i.id,
    i.estudiante_id AS "estudianteId",
    i.curso_periodo_id AS "cursoPeriodoId",
    i.periodo_id AS "periodoId",
    i.origen,
    i.fecha_inscripcion AS "fechaInscripcion",
    i.fecha_retiro AS "fechaRetiro",
    i.estado,
    i.observacion,
    e.usuario_id AS "usuarioId",
    e.estado AS "estudianteEstado",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    ud.numero_doc AS "numeroDoc",
    cp.curso_id AS "cursoId",
    cp.estado AS "cursoPeriodoEstado",
     c.activo AS "cursoActivo",
    cp.capacidad_maxima AS "capacidadMaxima",
    c.nivel,
    c.grado,
    c.paralelo,
    p.anio,
    p.nombre AS "periodoNombre",
    p.fecha_inicio AS "periodoInicio",
    p.fecha_fin AS "periodoFin",
    p.activo AS "periodoActivo",
    p.estado AS "periodoEstado"
  FROM inscripciones i
  JOIN estudiantes e ON e.id = i.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
  LEFT JOIN usuario_documentos ud ON ud.usuario_id = u.id AND LOWER(ud.tipo_doc) = 'ci'
  JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  JOIN periodos_academicos p ON p.id = cp.periodo_id
`;

export async function listInscripciones(
  pagination: PaginationQuery,
  filters: {
    estudianteId?: string;
    cursoPeriodoId?: string;
    periodoId?: string;
    estado?: string;
    buscar?: string;
    viewerUserId?: string;
    viewerRole?: string;
  },
): Promise<PaginatedResult<Inscripcion>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.estudianteId) {
    if (!/^\d+$/.test(filters.estudianteId)) throw new HttpError(400, "estudianteId debe ser numérico");
    conditions.push(`i.estudiante_id = $${idx++}`);
    params.push(await resolveEstudianteFilterId(filters.estudianteId));
  }
  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`i.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.periodoId) {
    if (!/^\d+$/.test(filters.periodoId)) throw new HttpError(400, "periodoId debe ser numérico");
    conditions.push(`cp.periodo_id = $${idx++}`);
    params.push(filters.periodoId);
  }
  if (filters.estado) {
    conditions.push(`i.estado = $${idx++}`);
    params.push(parseEstado(filters.estado));
  }
  if (filters.buscar) {
    conditions.push(`(
      u.nombre ILIKE $${idx} OR
      u.apellido_paterno ILIKE $${idx} OR
      u.apellido_materno ILIKE $${idx} OR
      ud.numero_doc ILIKE $${idx}
    )`);
    params.push(`%${filters.buscar}%`);
    idx++;
  }
  if (filters.viewerRole === "estudiante" && filters.viewerUserId) {
    conditions.push(`(
      e.usuario_id = $${idx}
      OR EXISTS (
        SELECT 1 FROM estudiante_apoderado ea
        JOIN apoderados a ON a.id = ea.apoderado_id
        WHERE ea.estudiante_id = e.id AND a.usuario_id = $${idx}
      )
    )`);
    params.push(filters.viewerUserId);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<InscripcionRow>(
        `${SELECT} ${where} ORDER BY i.fecha_inscripcion DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM inscripciones i
         JOIN estudiantes e ON e.id = i.estudiante_id
         JOIN usuarios u ON u.id = e.usuario_id
         LEFT JOIN usuario_documentos ud ON ud.usuario_id = u.id AND LOWER(ud.tipo_doc) = 'ci'
         JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapInscripcion),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar inscripciones");
  }
}

export async function getInscripcionById(id: string, viewerUserId?: string, viewerRole?: string): Promise<Inscripcion> {
  const scope = viewerRole === "estudiante" && viewerUserId
    ? ` AND (e.usuario_id = $2 OR EXISTS (
        SELECT 1 FROM estudiante_apoderado ea
        JOIN apoderados a ON a.id = ea.apoderado_id
        WHERE ea.estudiante_id = e.id AND a.usuario_id = $2
      ))`
    : "";
  const res = await query<InscripcionRow>(`${SELECT} WHERE i.id = $1${scope}`, scope ? [id, viewerUserId] : [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Inscripción id=${id} no encontrada`);
  }
  return mapInscripcion(res.rows[0]);
}

export async function createInscripcion(input: CreateInscripcionInput): Promise<Inscripcion> {
  const estInput = String(input.estudianteId ?? "").trim();
  const cpInput = String(input.cursoPeriodoId ?? "").trim();
  if (!/^\d+$/.test(estInput)) throw new HttpError(400, "estudianteId debe ser numérico");
  if (!/^\d+$/.test(cpInput)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");

  // Resolver estudiante (aceptar id de estudiantes o usuario_id)
  const estudiante = await resolveEstudianteId(estInput);
  if (estudiante.estado === "suspendido" || estudiante.estado === "retirado") {
    throw new HttpError(400, `El estudiante no está habilitado para inscripción (estado: ${estudiante.estado})`);
  }
  const estudianteId = toId(estudiante.id);

  // Verificar curso_periodo
  const cpRes = await query<{ id: bigint; periodo_id: bigint; capacidad_maxima: number; estado: string; grado: string; paralelo: string; cursoActivo: boolean; periodoActivo: boolean; periodoEstado: string }>(
    `SELECT cp.id, cp.periodo_id, cp.capacidad_maxima, cp.estado, c.grado, c.paralelo,
       c.activo AS "cursoActivo",
       p.activo AS "periodoActivo", p.estado AS "periodoEstado"
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [cpInput],
  );
  if (cpRes.rows.length === 0) {
    throw new HttpError(404, `Curso del periodo id=${cpInput} no encontrado`);
  }
  const cursoPeriodo = cpRes.rows[0];
  if (cursoPeriodo.estado !== "activo" || !cursoPeriodo.cursoActivo) {
    throw new HttpError(400, `El curso en este periodo se encuentra cerrado, cancelado o inactivo (estado: ${cursoPeriodo.estado})`);
  }
  if (!cursoPeriodo.periodoActivo || cursoPeriodo.periodoEstado !== "activo") {
    throw new HttpError(409, "La gestión académica no está activa; no se pueden crear inscripciones");
  }

  // Verificar si ya cuenta con inscripción activa en el mismo periodo
  const prevPeriodoRes = await query<{ id: bigint; grado: string; paralelo: string }>(
    `SELECT i.id, c.grado, c.paralelo
     FROM inscripciones i
     JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     WHERE i.estudiante_id = $1 AND i.periodo_id = $2 AND i.estado = 'activo'`,
    [estudianteId, cursoPeriodo.periodo_id],
  );
  if (prevPeriodoRes.rows.length > 0) {
    const prev = prevPeriodoRes.rows[0];
    throw new HttpError(
      409,
      `El estudiante ya cuenta con inscripción activa en este año lectivo (Curso: ${prev.grado} ${prev.paralelo})`,
    );
  }

  const origen = input.origen ?? "nueva";
  if (!["nueva", "reserva", "promocion"].includes(origen)) {
    throw new HttpError(400, "origen de inscripción inválido");
  }
  const solicitudId = input.solicitudId ? String(input.solicitudId) : null;
  if (solicitudId && !/^\d+$/.test(solicitudId)) throw new HttpError(400, "solicitudId debe ser numérico");
  if (solicitudId) {
    const solicitud = await query<{ id: bigint }>(
      `SELECT id FROM solicitudes_inscripcion
       WHERE id = $1 AND estudiante_id = $2 AND curso_periodo_destino_id = $3 AND estado = 'aprobada'`,
      [solicitudId, estudianteId, cpInput],
    );
    if (!solicitud.rows.length) throw new HttpError(409, "La solicitud no corresponde a una inscripción aprobada");
  }

  // Transacción con verificación de capacidad
  let newId: string;
  try {
    newId = await sTransaction(async (tx) => {
      await tx.queryObject(`SELECT id FROM estudiantes WHERE id = $1 FOR UPDATE`, [estudianteId]);
      const lockedPeriodo = await tx.queryObject<{ id: bigint; activo: boolean; estado: string }>(
        `SELECT id, activo, estado FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
        [cursoPeriodo.periodo_id],
      );
      if (!lockedPeriodo.rows.length || !lockedPeriodo.rows[0].activo || lockedPeriodo.rows[0].estado !== "activo") {
        throw new HttpError(409, "La gestión académica ya no está activa");
      }
      const lockedCp = await tx.queryObject<{ id: bigint; periodo_id: bigint; capacidad_maxima: number; estado: string }>(
        `SELECT id, periodo_id, capacidad_maxima, estado FROM cursos_periodo WHERE id = $1 FOR UPDATE`,
        [cpInput],
      );
      if (!lockedCp.rows.length) throw new HttpError(404, `Curso del periodo id=${cpInput} no encontrado`);
      if (lockedCp.rows[0].estado !== "activo") throw new HttpError(400, "El curso ya no está activo");
      const countRes = await tx.queryObject<{ count: string }>(
        `SELECT COUNT(*) AS count FROM inscripciones WHERE curso_periodo_id = $1 AND estado = 'activo'`,
        [cpInput],
      );
      const inscritos = Number(countRes.rows[0]?.count ?? 0);
      const capacidadActual = Number(lockedCp.rows[0].capacidad_maxima);
      if (inscritos >= capacidadActual) {
        throw new HttpError(
          400,
          `El curso ha alcanzado su capacidad máxima permitida (${capacidadActual} estudiantes)`,
        );
      }

      const res = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO inscripciones
           (estudiante_id, curso_periodo_id, periodo_id, solicitud_id, origen, fecha_inscripcion, observacion, estado)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7, 'activo')
         RETURNING id`,
        [estudianteId, cpInput, cursoPeriodo.periodo_id, solicitudId, origen, input.fechaInscripcion ?? null, input.observacion ?? null],
      );
      return toId(res.rows[0].id);
    });
  } catch (err) {
    throw mapDbError(err, "Error al procesar la inscripción del estudiante");
  }

  return await getInscripcionById(newId);
}

export async function habilitarInscripcion(
  usuarioId: string,
  cursoPeriodoId: string,
): Promise<Inscripcion> {
  return createInscripcion({
    estudianteId: usuarioId,
    cursoPeriodoId,
    origen: "nueva",
    observacion: "Inscripción habilitada por el estudiante",
  });
}

export async function updateInscripcion(id: string, input: UpdateInscripcionInput): Promise<Inscripcion> {
  const current = await getInscripcionById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  let nextEstado: EstadoInscripcion | undefined;

  if (input.estado !== undefined) {
    nextEstado = parseEstado(input.estado);
    if (nextEstado === "activo" && input.fechaRetiro) {
      throw new HttpError(400, "Una inscripción activa no puede tener fecha de retiro");
    }
    fields.push(`estado = $${idx++}`);
    params.push(nextEstado);
    if (nextEstado === "retirado" && !current.fechaRetiro && input.fechaRetiro === undefined) {
      fields.push(`fecha_retiro = NOW()`);
    } else if (nextEstado === "activo" && input.fechaRetiro === undefined) {
      fields.push(`fecha_retiro = NULL`);
    }
  }

  if (input.fechaRetiro !== undefined) {
    fields.push(`fecha_retiro = $${idx++}`);
    params.push(input.fechaRetiro ? new Date(input.fechaRetiro) : null);
  }

  if (input.observacion !== undefined) {
    fields.push(`observacion = $${idx++}`);
    params.push(input.observacion);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    await sTransaction(async (tx) => {
      if (nextEstado === "activo" && current.estado !== "activo") {
        await tx.queryObject(`SELECT id FROM estudiantes WHERE id = $1 FOR UPDATE`, [current.estudianteId]);
        const period = await tx.queryObject<{ activo: boolean; estado: string }>(
          `SELECT activo, estado FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
          [current.periodoId],
        );
        if (!period.rows.length || !period.rows[0].activo || period.rows[0].estado !== "activo") {
          throw new HttpError(409, "No se puede reactivar una inscripción de una gestión cerrada");
        }
        const course = await tx.queryObject<{ estado: string; capacidad: number }>(
          `SELECT estado, capacidad_maxima AS capacidad FROM cursos_periodo WHERE id = $1 FOR UPDATE`,
          [current.cursoPeriodoId],
        );
        if (!course.rows.length || course.rows[0].estado !== "activo") {
          throw new HttpError(409, "No se puede reactivar una inscripción de un curso cerrado");
        }
        const count = await tx.queryObject<{ count: string }>(
          `SELECT COUNT(*) AS count FROM inscripciones
           WHERE curso_periodo_id = $1 AND estado = 'activo' AND id <> $2`,
          [current.cursoPeriodoId, id],
        );
        if (Number(count.rows[0]?.count ?? 0) >= Number(course.rows[0].capacidad)) {
          throw new HttpError(409, "El curso no tiene capacidad para reactivar la inscripción");
        }
      }
      params.push(id);
      await tx.queryObject(`UPDATE inscripciones SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    });
    return await getInscripcionById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar la inscripción");
  }
}

export async function deleteInscripcion(id: string): Promise<void> {
  await getInscripcionById(id);
  try {
    await query(`DELETE FROM inscripciones WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar la inscripción: tiene calificaciones o pagos asociados");
  }
}
