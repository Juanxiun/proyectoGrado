import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreateInscripcionInput,
  ESTADOS_INSCRIPCION,
  EstadoInscripcion,
  Inscripcion,
  PaginatedResult,
  PaginationQuery,
  UpdateInscripcionInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface InscripcionRow {
  id: bigint;
  estudianteId: bigint;
  cursoPeriodoId: bigint;
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
  periodoId?: bigint;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  capacidadMaxima?: number;
  anio?: number;
  periodoNombre?: string;
}

function mapInscripcion(row: InscripcionRow): Inscripcion {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    cursoPeriodoId: toId(row.cursoPeriodoId),
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
        estado: "activo",
        curso: {
          id: toId(row.cursoId),
          nivel: row.nivel ?? "",
          grado: row.grado ?? "",
          paralelo: row.paralelo ?? "",
          capacidadMaxima: Number(row.capacidadMaxima ?? 0),
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

function parseEstado(value: unknown): EstadoInscripcion {
  const estado = String(value ?? "").trim().toLowerCase() as EstadoInscripcion;
  if (!ESTADOS_INSCRIPCION.includes(estado)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS_INSCRIPCION.join(", ")}`);
  }
  return estado;
}

const SELECT = `
  SELECT
    i.id,
    i.estudiante_id AS "estudianteId",
    i.curso_periodo_id AS "cursoPeriodoId",
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
    cp.periodo_id AS "periodoId",
    cp.capacidad_maxima AS "capacidadMaxima",
    c.nivel,
    c.grado,
    c.paralelo,
    p.anio,
    p.nombre AS "periodoNombre"
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
  },
): Promise<PaginatedResult<Inscripcion>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.estudianteId) {
    if (!/^\d+$/.test(filters.estudianteId)) throw new HttpError(400, "estudianteId debe ser numérico");
    conditions.push(`(i.estudiante_id = $${idx} OR e.usuario_id = $${idx})`);
    params.push(filters.estudianteId);
    idx++;
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

export async function getInscripcionById(id: string): Promise<Inscripcion> {
  const res = await query<InscripcionRow>(`${SELECT} WHERE i.id = $1`, [id]);
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
  const estRes = await query<{ id: bigint; estado: string; usuario_id: bigint }>(
    `SELECT id, estado, usuario_id FROM estudiantes WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
    [estInput],
  );
  if (estRes.rows.length === 0) {
    throw new HttpError(404, `Estudiante id=${estInput} no encontrado`);
  }
  const estudiante = estRes.rows[0];
  if (estudiante.estado === "suspendido" || estudiante.estado === "retirado") {
    throw new HttpError(400, `El estudiante no está habilitado para inscripción (estado: ${estudiante.estado})`);
  }
  const estudianteId = toId(estudiante.id);

  // Verificar curso_periodo
  const cpRes = await query<{ id: bigint; periodo_id: bigint; capacidad_maxima: number; estado: string; grado: string; paralelo: string }>(
    `SELECT cp.id, cp.periodo_id, cp.capacidad_maxima, cp.estado, c.grado, c.paralelo
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     WHERE cp.id = $1`,
    [cpInput],
  );
  if (cpRes.rows.length === 0) {
    throw new HttpError(404, `Curso del periodo id=${cpInput} no encontrado`);
  }
  const cursoPeriodo = cpRes.rows[0];
  if (cursoPeriodo.estado !== "activo") {
    throw new HttpError(400, `El curso en este periodo se encuentra cerrado o cancelado (estado: ${cursoPeriodo.estado})`);
  }

  // Verificar si ya cuenta con inscripción activa en el mismo periodo
  const prevPeriodoRes = await query<{ id: bigint; grado: string; paralelo: string }>(
    `SELECT i.id, c.grado, c.paralelo
     FROM inscripciones i
     JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     WHERE i.estudiante_id = $1 AND cp.periodo_id = $2 AND i.estado = 'activo'`,
    [estudianteId, cursoPeriodo.periodo_id],
  );
  if (prevPeriodoRes.rows.length > 0) {
    const prev = prevPeriodoRes.rows[0];
    throw new HttpError(
      409,
      `El estudiante ya cuenta con inscripción activa en este año lectivo (Curso: ${prev.grado} ${prev.paralelo})`,
    );
  }

  // Transacción con verificación de capacidad
  let newId: string;
  try {
    newId = await sTransaction(async (tx) => {
      const countRes = await tx.queryObject<{ count: string }>(
        `SELECT COUNT(*) AS count FROM inscripciones WHERE curso_periodo_id = $1 AND estado = 'activo'`,
        [cpInput],
      );
      const inscritos = Number(countRes.rows[0]?.count ?? 0);
      if (inscritos >= Number(cursoPeriodo.capacidad_maxima)) {
        throw new HttpError(
          400,
          `El curso ha alcanzado su capacidad máxima permitida (${cursoPeriodo.capacidad_maxima} estudiantes)`,
        );
      }

      const res = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO inscripciones (estudiante_id, curso_periodo_id, observacion, estado)
         VALUES ($1, $2, $3, 'activo')
         RETURNING id`,
        [estudianteId, cpInput, input.observacion ?? null],
      );
      return toId(res.rows[0].id);
    });
  } catch (err) {
    throw mapDbError(err, "Error al procesar la inscripción del estudiante");
  }

  return await getInscripcionById(newId);
}

export async function updateInscripcion(id: string, input: UpdateInscripcionInput): Promise<Inscripcion> {
  const current = await getInscripcionById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.estado !== undefined) {
    const estado = parseEstado(input.estado);
    fields.push(`estado = $${idx++}`);
    params.push(estado);
    if (estado === "retirado" && !current.fechaRetiro) {
      fields.push(`fecha_retiro = NOW()`);
    } else if (estado === "activo") {
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
    params.push(id);
    await query(`UPDATE inscripciones SET ${fields.join(", ")} WHERE id = $${idx}`, params);
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
