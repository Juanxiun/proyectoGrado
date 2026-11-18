// service -> logica asistencia
import { query, sTransaction } from "../connects/Database/transaction.ts";
import { withRetry } from "../connects/Database/reintento.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { publicarEventoControl, publicarEventoConfig } from "../utils/events.ts";
import {
  Asistencia,
  CreateAsistenciaInput,
  UpdateAsistenciaInput,
  BulkAsistenciaInput,
  FiltroAsistencia,
  EstadoAsistencia,
} from "../models/control-academico.ts";
import { controlAcademicoConfig } from "../config/control-academico.config.ts";

interface AsistenciaRowDB {
  id: bigint;
  estudianteId: bigint;
  asignacionId: bigint;
  materiaId: bigint;
  temaId?: bigint | null;
  fecha: Date | string;
  estado: string;
  justificacion?: string | null;
  horaRegistro?: string | null;
  validadoPorHorario: boolean;
  fechaRegistro: Date | string;
  fechaActualizacion: Date | string;
  // fila -> datos estudiante
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  // fila -> datos asignacion
  materiaNombre?: string;
  cursoPeriodoId?: bigint;
  cursoNombre?: string;
  horarioInicio?: string;
  horarioFin?: string;
}

async function mapAsistencia(row: AsistenciaRowDB): Promise<Asistencia> {
  return serialize({
    id: toId(row.id),
    estudianteId: toId(row.estudianteId),
    asignacionId: toId(row.asignacionId),
    materiaId: toId(row.materiaId),
    temaId: row.temaId ? toId(row.temaId) : undefined,
    fecha: (asDateString(row.fecha) as string) ?? new Date().toISOString().split("T")[0],
    estado: row.estado as EstadoAsistencia,
    justificacion: row.justificacion ?? null,
    horaRegistro: row.horaRegistro ?? null,
    validadoPorHorario: Boolean(row.validadoPorHorario),
    fechaRegistro: (asDateTimeString(row.fechaRegistro) as string) ?? new Date().toISOString(),
    fechaActualizacion: (asDateTimeString(row.fechaActualizacion) as string) ?? new Date().toISOString(),
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      }
      : null,
    asignacion: row.materiaNombre
      ? {
        id: toId(row.asignacionId),
        materiaNombre: row.materiaNombre,
        cursoPeriodoId: row.cursoPeriodoId ? toId(row.cursoPeriodoId) : undefined,
        cursoNombre: row.cursoNombre,
        horarioInicio: row.horarioInicio,
        horarioFin: row.horarioFin,
      }
      : null,
  }) as unknown as Asistencia;
}

const SELECT = `
  SELECT
    a.id,
    a.estudiante_id AS "estudianteId",
    a.asignacion_id AS "asignacionId",
    a.materia_id AS "materiaId",
    a.tema_id AS "temaId",
    a.fecha,
    a.estado,
    a.justificacion,
    a.hora_registro AS "horaRegistro",
    a.validado_por_horario AS "validadoPorHorario",
    a.fecha_registro AS "fechaRegistro",
    a.fecha_actualizacion AS "fechaActualizacion",
    e.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    e.numero_doc AS "numeroDoc",
    m.nombre AS "materiaNombre",
    cp.id AS "cursoPeriodoId",
    c.grado || '° "' || c.paralelo || '" ' || c.nivel AS "cursoNombre",
    h.hora_inicio AS "horarioInicio",
    h.hora_fin AS "horarioFin"
  FROM asistencia a
  JOIN estudiantes e ON e.id = a.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
  JOIN asignaciones_docentes ad ON ad.id = a.asignacion_id
  JOIN materias m ON m.id = a.materia_id
  JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  LEFT JOIN horarios h ON h.curso_periodo_id = cp.id AND h.materia_id = a.materia_id AND h.estado = 'activo'
`;

// service -> validar horario de clase
async function validarHorarioClase(asignacionId: string, materiaId: string, fecha: string, horaRegistro?: string | null): Promise<{ valido: boolean; horarioInicio?: string; horarioFin?: string }> {
  try {
    const res = await query<{ hora_inicio: string; hora_fin: string; dia_semana: number }>(
      `SELECT h.hora_inicio, h.hora_fin, h.dia_semana
       FROM horarios h
       WHERE h.asignacion_id = $1 AND h.materia_id = $2 AND h.estado = 'activo'`,
      [asignacionId, materiaId],
    );

    if (res.rows.length === 0) {
      return { valido: false }; // no hay horario configurado
    }

    const fechaObj = new Date(fecha + "T00:00:00");
    const diaSemana = fechaObj.getDay(); // 0=Domingo, 1=Lunes, ...

    const horarioDia = res.rows.find((h) => h.dia_semana === diaSemana);
    if (!horarioDia) {
      return { valido: false }; // no hay clase ese dia
    }

    if (!horaRegistro) return { valido: true, horarioInicio: horarioDia.hora_inicio, horarioFin: horarioDia.hora_fin };

    const [hReg, mReg] = horaRegistro.split(":").map(Number);
    const [hIni, mIni] = horarioDia.hora_inicio.split(":").map(Number);
    const [hFin, mFin] = horarioDia.hora_fin.split(":").map(Number);

    const minRegistro = hReg * 60 + mReg;
    const minInicio = hIni * 60 + mIni;
    const minFin = hFin * 60 + mFin;
    const tolerancia = 10; // minutos de tolerancia

    const valido = minRegistro >= minInicio - tolerancia && minRegistro <= minFin + tolerancia;

    return {
      valido,
      horarioInicio: horarioDia.hora_inicio,
      horarioFin: horarioDia.hora_fin,
    };
  } catch {
    return { valido: true }; // en caso de error, permitir
  }
}

export async function listAsistencias(
  pagination: { page: number; limit: number; offset: number },
  filters: FiltroAsistencia,
): Promise<{ data: Asistencia[]; total: number; page: number; limit: number; totalPages: number }> {
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
    conditions.push(`a.estudiante_id = $${idx++}`);
    params.push(filters.estudianteId);
  }
  if (filters.materiaId) {
    if (!/^\d+$/.test(filters.materiaId)) throw new HttpError(400, "materiaId debe ser numérico");
    conditions.push(`a.materia_id = $${idx++}`);
    params.push(filters.materiaId);
  }
  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`ad.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.fechaDesde) {
    conditions.push(`a.fecha >= $${idx++}`);
    params.push(filters.fechaDesde);
  }
  if (filters.fechaHasta) {
    conditions.push(`a.fecha <= $${idx++}`);
    params.push(filters.fechaHasta);
  }
  if (filters.estado) {
    conditions.push(`a.estado = $${idx++}`);
    params.push(filters.estado);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<AsistenciaRowDB>(
        `${SELECT} ${where} ORDER BY a.fecha DESC, u.apellido_paterno, u.nombre LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM asistencia a
         JOIN estudiantes e ON e.id = a.estudiante_id
         JOIN usuarios u ON u.id = e.usuario_id
         JOIN asignaciones_docentes ad ON ad.id = a.asignacion_id
         JOIN materias m ON m.id = a.materia_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: await Promise.all(dataRes.rows.map(mapAsistencia)),
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
  const res = await query<AsistenciaRowDB>(`${SELECT} WHERE a.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Registro de asistencia id=${id} no encontrado`);
  }
  return await mapAsistencia(res.rows[0]);
}

export async function createAsistencia(input: CreateAsistenciaInput): Promise<Asistencia> {
  const asigId = String(input.asignacionId ?? "").trim();
  const matId = String(input.materiaId ?? "").trim();
  const estInput = String(input.estudianteId ?? "").trim();

  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!/^\d+$/.test(matId)) throw new HttpError(400, "materiaId debe ser numérico");
  if (!/^\d+$/.test(estInput)) throw new HttpError(400, "estudianteId debe ser numérico");

  if (!input.fecha) throw new HttpError(400, "fecha es obligatoria (formato YYYY-MM-DD)");
  if (!["presente", "ausente", "atraso", "justificado"].includes(input.estado)) {
    throw new HttpError(400, "estado inválido. Opciones: presente, ausente, atraso, justificado");
  }

  const estudianteRes = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`, [estInput]);
  let estudianteId: string;
  if (estudianteRes.rows.length > 0) {
    estudianteId = toId(estudianteRes.rows[0].id);
  } else {
    const estRes2 = await query<{ id: bigint }>(`SELECT id FROM estudiantes WHERE id = $1 LIMIT 1`, [estInput]);
    if (estRes2.rows.length === 0) throw new HttpError(404, `Estudiante id=${estInput} no encontrado`);
    estudianteId = toId(estRes2.rows[0].id);
  }

  const asigRes = await query<{ id: bigint }>(`SELECT id FROM asignaciones_docentes WHERE id = $1`, [asigId]);
  if (asigRes.rows.length === 0) throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);

  const matRes = await query<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1`, [matId]);
  if (matRes.rows.length === 0) throw new HttpError(404, `Materia id=${matId} no encontrada`);

  // validar horario si hay hora de registro
  let validadoPorHorario = false;
  let horarioInicio: string | undefined;
  let horarioFin: string | undefined;

  if (input.horaRegistro) {
    const validacion = await validarHorarioClase(asigId, matId, input.fecha, input.horaRegistro);
    validadoPorHorario = validacion.valido;
    horarioInicio = validacion.horarioInicio;
    horarioFin = validacion.horarioFin;
  }

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO asistencia (
         estudiante_id, asignacion_id, materia_id, fecha, estado, justificacion,
         hora_registro, validado_por_horario
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (estudiante_id, asignacion_id, materia_id, fecha)
       DO UPDATE SET
         estado = EXCLUDED.estado,
         justificacion = EXCLUDED.justificacion,
         hora_registro = EXCLUDED.hora_registro,
         validado_por_horario = EXCLUDED.validado_por_horario,
         fecha_actualizacion = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        estudianteId,
        asigId,
        matId,
        input.fecha,
        input.estado,
        input.justificacion?.trim() ?? null,
        input.horaRegistro ?? null,
        validadoPorHorario,
      ],
    );

    const created = await getAsistenciaById(toId(res.rows[0].id));

    // publicar evento
    publicarEventoConfig("asistenciaRegistrada", {
      asistenciaId: created.id,
      estudianteId: created.estudianteId,
      asignacionId: created.asignacionId,
      materiaId: created.materiaId,
      fecha: created.fecha,
      estado: created.estado,
      validadoPorHorario: created.validadoPorHorario,
      timestamp: new Date().toISOString(),
    });

    return created;
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
    if (!["presente", "ausente", "atraso", "justificado"].includes(input.estado)) {
      throw new HttpError(400, "estado inválido");
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

export async function saveBulkAsistencias(input: BulkAsistenciaInput): Promise<{ totalGuardados: number; resultados: Array<{ estudianteId: string; exito: boolean; error?: string }> }> {
  const asigId = String(input.asignacionId ?? "").trim();
  const matId = String(input.materiaId ?? "").trim();
  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!/^\d+$/.test(matId)) throw new HttpError(400, "materiaId debe ser numérico");
  if (!input.fecha) throw new HttpError(400, "fecha es obligatoria (formato YYYY-MM-DD)");

  if (!Array.isArray(input.asistencias) || input.asistencias.length === 0) {
    throw new HttpError(400, "La lista de asistencias no puede estar vacía");
  }

  const asigRes = await query<{ id: bigint }>(`SELECT id FROM asignaciones_docentes WHERE id = $1`, [asigId]);
  if (asigRes.rows.length === 0) throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);

  const resultados: Array<{ estudianteId: string; exito: boolean; error?: string }> = [];
  let guardados = 0;

  try {
    await sTransaction(async (client) => {
      for (const item of input.asistencias) {
        if (!["presente", "ausente", "atraso", "justificado"].includes(item.estado)) {
          resultados.push({ estudianteId: String(item.estudianteId), exito: false, error: `Estado '${item.estado}' inválido` });
          continue;
        }
        const estId = String(item.estudianteId).trim();

        let estRes = await client.queryObject<{ id: bigint }>(
          `SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`,
          [estId],
        );
        if (!estRes.rows.length) {
          estRes = await client.queryObject<{ id: bigint }>(
            `SELECT id FROM estudiantes WHERE id = $1 LIMIT 1`,
            [estId],
          );
        }
        if (!estRes.rows.length) {
          resultados.push({ estudianteId: estId, exito: false, error: "Estudiante no encontrado" });
          continue;
        }
        const realEstId = toId(estRes.rows[0].id);

        // validar horario
        let validadoPorHorario = false;
        if ((item as any).horaRegistro) {
          const validacion = await validarHorarioClase(asigId, matId, input.fecha, (item as any).horaRegistro);
          validadoPorHorario = validacion.valido;
        }

        await client.queryObject(
          `INSERT INTO asistencia (
             estudiante_id, asignacion_id, materia_id, fecha, estado, justificacion,
             hora_registro, validado_por_horario
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (estudiante_id, asignacion_id, materia_id, fecha)
           DO UPDATE SET
             estado = EXCLUDED.estado,
             justificacion = EXCLUDED.justificacion,
             hora_registro = EXCLUDED.hora_registro,
             validado_por_horario = EXCLUDED.validado_por_horario,
             fecha_actualizacion = CURRENT_TIMESTAMP`,
          [realEstId, asigId, matId, input.fecha, item.estado, item.justificacion?.trim() ?? null, (item as any).horaRegistro ?? null, validadoPorHorario],
        );

        guardados++;
        resultados.push({ estudianteId: realEstId, exito: true });
      }
    });

    // publicar evento
    publicarEventoConfig("asistenciaRegistrada", {
      bulk: true,
      totalGuardados: guardados,
      fecha: input.fecha,
      asignacionId: asigId,
      timestamp: new Date().toISOString(),
    });

    return { totalGuardados: guardados, resultados };
  } catch (err) {
    throw mapDbError(err, "Error al guardar asistencia por lote");
  }
}

// service -> obtener reporte asistencia por curso
export async function getReporteAsistenciaCurso(cursoPeriodoId: string, materiaId: string): Promise<any> {
  // implementar reporte detallado
  const res = await query<any>(
    `SELECT 
       e.id AS estudiante_id,
       u.nombre,
       u.apellido_paterno,
       u.apellido_materno,
       e.numero_doc,
       COUNT(CASE WHEN a.estado = 'presente' THEN 1 END) AS presente,
       COUNT(CASE WHEN a.estado = 'ausente' THEN 1 END) AS ausente,
       COUNT(CASE WHEN a.estado = 'atraso' THEN 1 END) AS atraso,
       COUNT(CASE WHEN a.estado = 'justificado' THEN 1 END) AS justificado,
       COUNT(a.id) AS total_clases
     FROM estudiantes e
     JOIN usuarios u ON u.id = e.usuario_id
     JOIN inscripciones i ON i.estudiante_id = e.id AND i.estado = 'activo'
     JOIN cursos_periodo cp ON cp.id = i.curso_periodo_id
     LEFT JOIN asistencia a ON a.estudiante_id = e.id AND a.materia_id = $2
     WHERE cp.id = $1 AND i.estado = 'activo'
     GROUP BY e.id, u.nombre, u.apellido_paterno, u.apellido_materno, e.numero_doc`,
    [cursoPeriodoId, materiaId],
  );

  const asistencias = res.rows.map((r) => {
    const total = Number(r.total_clases);
    const presente = Number(r.presente);
    const tasa = total > 0 ? (presente / total) * 100 : 0;
    return {
      estudianteId: String(r.estudiante_id),
      nombreCompleto: `${r.nombre} ${r.apellido_paterno} ${r.apellido_materno || ""}`.trim(),
      presente: Number(r.presente),
      ausente: Number(r.ausente),
      atraso: Number(r.atraso),
      justificado: Number(r.justificado),
      tasaAsistencia: Math.round(tasa * 100) / 100,
    };
  });

  const promedioAsistencia = asistencias.length > 0
    ? asistencias.reduce((sum, a) => sum + a.tasaAsistencia, 0) / asistencias.length
    : 0;

  return {
    cursoPeriodoId,
    materiaId,
    totalEstudiantes: asistencias.length,
    totalClases: Math.max(...asistencias.map((a) => a.presente + a.ausente + a.atraso + a.justificado), 0),
    asistencias,
    resumen: {
      promedioAsistencia: Math.round(promedioAsistencia * 100) / 100,
      estudiantesEnRiesgo: asistencias.filter((a) => a.tasaAsistencia < 75).length,
    },
  };
}

export async function getAsistenciaEstudianteMateria(estudianteId: string, materiaId: string, fechaDesde?: string, fechaHasta?: string): Promise<any> {
  const conditions: string[] = ["a.estudiante_id = $1", "a.materia_id = $2"];
  const params: unknown[] = [estudianteId, materiaId];
  let idx = 3;

  if (fechaDesde) {
    conditions.push(`a.fecha >= $${idx++}`);
    params.push(fechaDesde);
  }
  if (fechaHasta) {
    conditions.push(`a.fecha <= $${idx++}`);
    params.push(fechaHasta);
  }

  const res = await query<AsistenciaRowDB>(
    `${SELECT} WHERE ${conditions.join(" AND ")} ORDER BY a.fecha DESC`,
    params,
  );

  return { data: await Promise.all(res.rows.map(mapAsistencia)) };
}