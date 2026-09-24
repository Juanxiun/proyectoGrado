import { query, sTransaction } from "../connects/Database/transaction.ts";
import type {
  CreateSolicitudInscripcionInput,
  SolicitudInscripcion,
  TipoSolicitudInscripcion,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface SolicitudRow {
  id: bigint;
  estudianteId: bigint;
  periodoId: bigint;
  cursoPeriodoDestinoId: bigint;
  tipo: TipoSolicitudInscripcion;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo: string | null;
  fechaSolicitud: Date | string;
  fechaProceso: Date | string | null;
  observacion: string | null;
}

function idValue(value: unknown, field: string): string {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new HttpError(400, `${field} debe ser numérico`);
  return id;
}

function mapSolicitud(row: SolicitudRow): SolicitudInscripcion {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    periodoId: toId(row.periodoId),
    cursoPeriodoDestinoId: toId(row.cursoPeriodoDestinoId),
    tipo: row.tipo,
    estado: row.estado,
    motivo: row.motivo,
    fechaSolicitud: asDateTimeString(row.fechaSolicitud) ?? "",
    fechaProceso: asDateTimeString(row.fechaProceso),
    observacion: row.observacion,
  });
}

const SELECT = `
  SELECT id, estudiante_id AS "estudianteId", periodo_id AS "periodoId",
    curso_periodo_destino_id AS "cursoPeriodoDestinoId", tipo, estado, motivo,
    fecha_solicitud AS "fechaSolicitud", fecha_proceso AS "fechaProceso", observacion
  FROM solicitudes_inscripcion
`;

function gradeNumber(value: unknown): number | null {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function gradeRank(nivel: unknown, grado: unknown): number | null {
  const number = gradeNumber(grado);
  if (number === null) return null;
  const offsets: Record<string, number> = {
    inicial: -6,
    primaria: 0,
    secundaria: 6,
    bachillerato: 12,
  };
  const offset = offsets[String(nivel ?? "").toLowerCase()];
  return offset === undefined ? null : offset + number;
}

async function resolveStudentId(userId: string): Promise<string> {
  const result = await query<{ id: bigint }>(
    `SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`,
    [userId],
  );
  if (!result.rows.length) throw new HttpError(404, "No se encontró el estudiante asociado al usuario");
  return toId(result.rows[0].id);
}

export async function crearSolicitud(
  userId: string,
  input: CreateSolicitudInscripcionInput,
): Promise<SolicitudInscripcion> {
  const estudianteId = await resolveStudentId(userId);
  const student = await query<{ estado: string }>(`SELECT estado FROM estudiantes WHERE id = $1`, [estudianteId]);
  if (!student.rows.length || ["suspendido", "retirado"].includes(student.rows[0].estado)) {
    throw new HttpError(409, "El estudiante no está habilitado para solicitar inscripción");
  }
  const destinoId = idValue(input.cursoPeriodoDestinoId, "cursoPeriodoDestinoId");
  if (!["reserva", "promocion"].includes(input.tipo)) throw new HttpError(400, "tipo de solicitud inválido");

  const target = await query<{
    periodoId: bigint;
    periodoActivo: boolean;
    periodoEstado: string;
    estado: string;
    cursoActivo: boolean;
    nivel: string;
    grado: string;
    anio: number;
    capacidad: number;
    inscritos: string;
  }>(
    `SELECT cp.periodo_id AS "periodoId", p.activo AS "periodoActivo", p.estado AS "periodoEstado",
       cp.estado, c.activo AS "cursoActivo", c.nivel, c.grado, p.anio, cp.capacidad_maxima AS capacidad,
       (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo') AS inscritos
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE cp.id = $1`,
    [destinoId],
  );
  if (!target.rows.length) throw new HttpError(404, "El curso de destino no existe");
  const course = target.rows[0];
  if (!course.periodoActivo || course.periodoEstado !== "activo" || course.estado !== "activo" || !course.cursoActivo) {
    throw new HttpError(409, "La gestión o el curso de destino no está activo");
  }
  if (Number(course.inscritos) >= Number(course.capacidad)) throw new HttpError(409, "El curso de destino no tiene cupos");
  const currentEnrollment = await query<{ id: bigint }>(
    `SELECT id FROM inscripciones WHERE estudiante_id = $1 AND periodo_id = $2 AND estado = 'activo' LIMIT 1`,
    [estudianteId, course.periodoId],
  );
  if (currentEnrollment.rows.length) {
    throw new HttpError(409, "El estudiante ya tiene una inscripción activa en la gestión destino");
  }

  const previous = await query<{ nivel: string; grado: string; anio: number }>(
    `SELECT c.nivel, c.grado, p.anio
     FROM inscripciones i
     JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     JOIN periodos_academicos p ON p.id = cp.periodo_id
     WHERE i.estudiante_id = $1 AND i.estado IN ('activo', 'finalizado') AND p.anio < $2
     ORDER BY p.anio DESC LIMIT 1`,
    [estudianteId, course.anio],
  );
  if (input.tipo === "promocion") {
    if (!previous.rows.length) throw new HttpError(409, "No se encontró una inscripción previa para promover");
    const previousGrade = gradeRank(previous.rows[0].nivel, previous.rows[0].grado);
    const targetGrade = gradeRank(course.nivel, course.grado);
    if (previousGrade === null || targetGrade === null || targetGrade <= previousGrade) {
      throw new HttpError(409, "La promoción debe mover al estudiante al grado superior correspondiente");
    }
  }

  const duplicate = await query<{ id: bigint }>(
    `SELECT id FROM solicitudes_inscripcion
     WHERE estudiante_id = $1 AND curso_periodo_destino_id = $2 AND estado = 'pendiente'`,
    [estudianteId, destinoId],
  );
  if (duplicate.rows.length) throw new HttpError(409, "Ya existe una solicitud pendiente para este curso");

  try {
    const result = await query<SolicitudRow>(
      `INSERT INTO solicitudes_inscripcion
         (estudiante_id, periodo_id, curso_periodo_destino_id, tipo, estado, motivo, solicitante_id)
       VALUES ($1, $2, $3, $4, 'pendiente', $5, $6)
       RETURNING id, estudiante_id AS "estudianteId", periodo_id AS "periodoId",
         curso_periodo_destino_id AS "cursoPeriodoDestinoId", tipo, estado, motivo,
         fecha_solicitud AS "fechaSolicitud", fecha_proceso AS "fechaProceso", observacion`,
      [estudianteId, course.periodoId, destinoId, input.tipo, input.motivo ?? null, userId],
    );
    return mapSolicitud(result.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear la solicitud de inscripción");
  }
}

export async function listarSolicitudes(
  userId: string,
  management = false,
): Promise<SolicitudInscripcion[]> {
  const result = management
    ? await query<SolicitudRow>(`${SELECT} ORDER BY fecha_solicitud DESC`)
    : await query<SolicitudRow>(`${SELECT} WHERE estudiante_id = (SELECT id FROM estudiantes WHERE usuario_id = $1) ORDER BY fecha_solicitud DESC`, [userId]);
  return result.rows.map(mapSolicitud);
}

export async function aprobarSolicitud(id: string, reviewerId: string): Promise<SolicitudInscripcion> {
  const solicitudId = idValue(id, "id");
  try {
    const result = await sTransaction(async (tx) => {
      const request = await tx.queryObject<SolicitudRow & { destinoPeriodoId: bigint; destinoEstado: string; cursoActivo: boolean; periodoActivo: boolean; periodoEstado: string; capacidad: number; inscritos: string; nivel: string; grado: string; anio: number; estudianteEstado: string }>(
        `SELECT s.id, s.estudiante_id AS "estudianteId", s.periodo_id AS "periodoId",
           s.curso_periodo_destino_id AS "cursoPeriodoDestinoId", s.tipo, s.estado, s.motivo,
           s.fecha_solicitud AS "fechaSolicitud", s.fecha_proceso AS "fechaProceso", s.observacion,
           e.estado AS "estudianteEstado",
           cp.periodo_id AS "destinoPeriodoId", cp.estado AS "destinoEstado",
           c.activo AS "cursoActivo",
           p.activo AS "periodoActivo", p.estado AS "periodoEstado",
           cp.capacidad_maxima AS capacidad, c.nivel, c.grado, p.anio,
           (SELECT COUNT(*) FROM inscripciones i WHERE i.curso_periodo_id = cp.id AND i.estado = 'activo') AS inscritos
         FROM solicitudes_inscripcion s
         JOIN estudiantes e ON e.id = s.estudiante_id
         JOIN cursos_periodo cp ON cp.id = s.curso_periodo_destino_id
         JOIN cursos c ON c.id = cp.curso_id
         JOIN periodos_academicos p ON p.id = cp.periodo_id
         WHERE s.id = $1 FOR UPDATE OF s, cp, p`,
        [solicitudId],
      );
      if (!request.rows.length) throw new HttpError(404, "Solicitud de inscripción no encontrada");
      const requestRow = request.rows[0];
      if (requestRow.estado !== "pendiente") throw new HttpError(409, "La solicitud ya fue procesada");
      if (["suspendido", "retirado"].includes(requestRow.estudianteEstado)) {
        throw new HttpError(409, "El estudiante no está habilitado para aprobar la inscripción");
      }
      if (!requestRow.periodoActivo || requestRow.periodoEstado !== "activo" || requestRow.destinoEstado !== "activo" || !requestRow.cursoActivo) {
        throw new HttpError(409, "La gestión o el curso de destino ya no está activo");
      }
      if (Number(requestRow.inscritos) >= Number(requestRow.capacidad)) throw new HttpError(409, "El curso de destino no tiene cupos");
      if (requestRow.tipo === "promocion") {
        const previous = await tx.queryObject<{ nivel: string; grado: string }>(
          `SELECT c.nivel, c.grado
           FROM inscripciones i
           JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
           JOIN cursos c ON c.id = cp.curso_id
           JOIN periodos_academicos p ON p.id = cp.periodo_id
           WHERE i.estudiante_id = $1 AND i.estado IN ('activo', 'finalizado') AND p.anio < $2
           ORDER BY p.anio DESC LIMIT 1`,
          [requestRow.estudianteId, requestRow.anio],
        );
        const previousGrade = gradeRank(previous.rows[0]?.nivel, previous.rows[0]?.grado);
        const targetGrade = gradeRank(requestRow.nivel, requestRow.grado);
        if (!previous.rows.length || previousGrade === null || targetGrade === null || targetGrade <= previousGrade) {
          throw new HttpError(409, "La promoción ya no cumple con el grado superior correspondiente");
        }
      }
      const duplicate = await tx.queryObject<{ id: bigint }>(
        `SELECT id FROM inscripciones WHERE estudiante_id = $1 AND periodo_id = $2 AND estado = 'activo'`,
        [requestRow.estudianteId, requestRow.periodoId],
      );
      if (duplicate.rows.length) throw new HttpError(409, "El estudiante ya tiene una inscripción activa en esta gestión");

      const enrollment = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO inscripciones
           (estudiante_id, curso_periodo_id, periodo_id, solicitud_id, origen, estado)
         VALUES ($1, $2, $3, $4, $5, 'activo') RETURNING id`,
        [requestRow.estudianteId, requestRow.cursoPeriodoDestinoId, requestRow.periodoId, solicitudId, requestRow.tipo],
      );
      await tx.queryObject(
        `UPDATE solicitudes_inscripcion SET estado = 'aprobada', procesado_por = $2, fecha_proceso = NOW() WHERE id = $1`,
        [solicitudId, reviewerId],
      );
      const updated = await tx.queryObject<SolicitudRow>(
        `${SELECT} WHERE id = $1`,
        [solicitudId],
      );
      return { request: updated.rows[0], enrollmentId: toId(enrollment.rows[0].id) };
    });
    return { ...mapSolicitud(result.request), enrollmentId: result.enrollmentId };
  } catch (err) {
    throw mapDbError(err, "Error al aprobar la solicitud de inscripción");
  }
}

export async function rechazarSolicitud(id: string, reviewerId: string, observacion?: string): Promise<SolicitudInscripcion> {
  const solicitudId = idValue(id, "id");
  try {
    const result = await query<SolicitudRow>(
      `UPDATE solicitudes_inscripcion
       SET estado = 'rechazada', procesado_por = $2, fecha_proceso = NOW(), observacion = $3
       WHERE id = $1 AND estado = 'pendiente'
       RETURNING id, estudiante_id AS "estudianteId", periodo_id AS "periodoId",
         curso_periodo_destino_id AS "cursoPeriodoDestinoId", tipo, estado, motivo,
         fecha_solicitud AS "fechaSolicitud", fecha_proceso AS "fechaProceso", observacion`,
      [solicitudId, reviewerId, observacion ?? null],
    );
    if (!result.rows.length) throw new HttpError(409, "La solicitud no existe o ya fue procesada");
    return mapSolicitud(result.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al rechazar la solicitud de inscripción");
  }
}
