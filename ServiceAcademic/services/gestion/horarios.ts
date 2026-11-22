import { query, sTransaction } from "../../connects/Database/transaction.ts";
import type {
  EstadoGestion,
  GenerarHorariosInput,
  GuardarHorarioManualInput,
  Horario,
} from "../../models/academic.ts";
import { HttpError, mapDbError } from "../../utils/errors.ts";
import { toId } from "../../utils/serialize.ts";
import {
  type ScheduleCourse,
  type ScheduleSession,
  generateSchedule,
} from "../../utils/horarioAlgoritmo.ts";
import {
  assertScheduleEditable,
  assertScheduleEditableTx,
  ensureAulas,
  ensureTurnos,
  idValue,
  mapHorario,
  type AsignacionRow,
  type CursoPeriodoRow,
  type HorarioRow,
  type MallaRow,
} from "./shared.ts";
import { activarAutomaticamenteSiEstaCompleta, obtenerEstadoGestion } from "./periodos.ts";

// horarios -> generación automática, listado y carga manual de horarios
// filtro -> priorizar id del maestro
async function resolveMaestroFilterId(value: string): Promise<string | null> {
  const byId = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE id = $1 LIMIT 1`,
    [value],
  );
  if (byId.rows.length) return toId(byId.rows[0].id);
  const byUsuario = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE usuario_id = $1 LIMIT 1`,
    [value],
  );
  return byUsuario.rows.length ? toId(byUsuario.rows[0].id) : null;
}

export async function generarHorarios(
  periodoId: string,
  input: GenerarHorariosInput = {},
): Promise<EstadoGestion> {
  await assertScheduleEditable(periodoId);
  const duracion = Number(input.duracionPeriodoMinutos ?? 45);
  if (duracion !== 45 && duracion !== 50) throw new HttpError(400, "La duración debe ser 45 o 50 minutos");

  try {
    await sTransaction(async (tx) => {
      await assertScheduleEditableTx(tx, periodoId);
      const turnos = await ensureTurnos(tx);
      const aulas = await ensureAulas(tx, input.aulaIds);
      const coursesResult = await tx.queryObject<CursoPeriodoRow>(
        `SELECT cp.id, cp.curso_id AS "cursoId", cp.periodo_id AS "periodoId",
           c.nivel, c.grado, c.paralelo, cp.turno_id AS "turnoId",
           cp.capacidad_maxima AS "capacidadMaxima"
         FROM cursos_periodo cp JOIN cursos c ON c.id = cp.curso_id
         WHERE cp.periodo_id = $1 AND cp.estado = 'activo'
         ORDER BY c.nivel, c.grado, c.paralelo`,
        [periodoId],
      );
      if (!coursesResult.rows.length) throw new HttpError(409, "La gestión no tiene cursos activos");
      for (const course of coursesResult.rows) {
        const requestedTurno = input.turnosPorCurso?.[toId(course.id)] ??
          input.turnosPorCurso?.[`${course.nivel}:${course.grado}:${course.paralelo}`] ??
          input.turnoPorNivel?.[course.nivel];
        if (requestedTurno) {
          if (requestedTurno !== "manana" && requestedTurno !== "tarde") {
            throw new HttpError(400, `Turno inválido para ${course.nivel} ${course.grado} ${course.paralelo}`);
          }
          const turno = turnos.get(requestedTurno);
          if (!turno) throw new HttpError(500, "No se pudo resolver el turno solicitado");
          await tx.queryObject(`UPDATE cursos_periodo SET turno_id = $2 WHERE id = $1`, [course.id, turno.id]);
          course.turnoId = turno.id;
        }
      }

      const mallasResult = await tx.queryObject<MallaRow>(
        `SELECT mc.id, mc.periodo_id AS "periodoId", mc.nivel, mc.grado,
           mc.materia_id AS "materiaId", mc.tipo_materia AS "tipoMateria",
           mc.carga_horaria_semanal AS "cargaHorariaSemanal",
           mc.peso_sintactico AS "pesoSintactico",
           m.nombre AS "materiaNombre", m.materia_pesada AS "materiaPesada"
         FROM mallas_curriculares mc JOIN materias m ON m.id = mc.materia_id AND m.activo = true
         WHERE mc.periodo_id = $1 AND mc.activo = true`,
        [periodoId],
      );
      const assignmentsResult = await tx.queryObject<AsignacionRow>(
        `SELECT ad.id, ad.curso_periodo_id AS "cursoPeriodoId", ad.materia_id AS "materiaId",
           ad.maestro_id AS "maestroId", ad.estado,
           COALESCE(m.materias_configuradas, false) AS "materiasConfiguradas",
           EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = ad.materia_id) AS "materiaPermitida"
         FROM asignaciones_docentes ad
         JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
         JOIN maestros m ON m.id = ad.maestro_id
         WHERE cp.periodo_id = $1 AND ad.estado = 'activo' AND m.estado = 'activo'`,
        [periodoId],
      );
      const assignmentsByCourseSubject = new Map<string, AsignacionRow>();
      for (const assignment of assignmentsResult.rows) {
        if (assignment.materiasConfiguradas && !assignment.materiaPermitida) {
          throw new HttpError(409, `El docente ${assignment.maestroId} no está habilitado para la materia ${assignment.materiaId}`);
        }
        const key = `${assignment.cursoPeriodoId}:${assignment.materiaId}`;
        if (assignmentsByCourseSubject.has(key)) {
          throw new HttpError(409, `La materia ${assignment.materiaId} tiene más de un docente activo en el mismo curso`);
        }
        assignmentsByCourseSubject.set(key, assignment);
      }

      for (const assignment of assignmentsResult.rows) {
        const course = coursesResult.rows.find((row) => toId(row.id) === toId(assignment.cursoPeriodoId));
        if (!course || !mallasResult.rows.some((malla) => malla.nivel === course.nivel && malla.grado === course.grado && toId(malla.materiaId) === toId(assignment.materiaId))) {
          throw new HttpError(409, "La asignación docente no corresponde a la malla curricular del curso");
        }
      }

      const courses: ScheduleCourse[] = [];
      for (const cp of coursesResult.rows) {
        const mallas = mallasResult.rows.filter((malla) =>
          malla.nivel === cp.nivel && malla.grado === cp.grado
        );
        const sessions: ScheduleSession[] = mallas.map((malla) => {
          if (malla.tipoMateria === "extracurricular" && Number(malla.pesoSintactico) >= 3) {
            throw new HttpError(409, `La materia extracurricular ${malla.materiaNombre} tiene un peso sintáctico no válido`);
          }
          const assignment = assignmentsByCourseSubject.get(`${cp.id}:${malla.materiaId}`);
          if (!assignment) {
            throw new HttpError(409, `La materia ${malla.materiaNombre} no tiene docente asignado en ${cp.grado} ${cp.paralelo}`);
          }
          return {
            materiaId: toId(malla.materiaId),
            materiaNombre: malla.materiaNombre,
            asignacionId: assignment ? toId(assignment.id) : null,
            maestroId: assignment ? toId(assignment.maestroId) : null,
            cargaHorariaSemanal: Number(malla.cargaHorariaSemanal),
            materiaPesada: Boolean(malla.materiaPesada),
            pesoSintactico: Number(malla.pesoSintactico),
          };
        });
        if (!sessions.length) {
          const seen = new Set<string>();
          for (const assignment of assignmentsResult.rows.filter((item) => item.cursoPeriodoId === cp.id)) {
            if (seen.has(toId(assignment.materiaId))) continue;
            seen.add(toId(assignment.materiaId));
            sessions.push({
              materiaId: toId(assignment.materiaId),
              materiaNombre: "Materia asignada",
              asignacionId: toId(assignment.id),
              maestroId: toId(assignment.maestroId),
              cargaHorariaSemanal: 5,
              materiaPesada: false,
              pesoSintactico: 1,
            });
          }
        }
        const turnoRow = cp.turnoId ? [...turnos.values()].find((turno) => toId(turno.id) === toId(cp.turnoId)) : turnos.get("manana");
        if (cp.turnoId && !turnoRow) throw new HttpError(409, `El turno del curso ${cp.id} no está activo`);
        if (!cp.turnoId && turnoRow) {
          await tx.queryObject(`UPDATE cursos_periodo SET turno_id = $2 WHERE id = $1`, [cp.id, turnoRow.id]);
          cp.turnoId = turnoRow.id;
        }
        courses.push({
          cursoPeriodoId: toId(cp.id),
          turno: turnoRow?.codigo ?? "manana",
          capacidadMaxima: Number(cp.capacidadMaxima),
          sesiones: sessions,
        });
      }
      if (courses.some((course) => !course.sesiones.length)) {
        throw new HttpError(409, "Todos los cursos deben tener mallas o asignaciones docentes antes de generar horarios");
      }

      const generated = generateSchedule(
        courses,
        aulas.map((aula) => ({ id: toId(aula.id), capacidad: Number(aula.capacidad) })),
        duracion as 45 | 50,
      );
      await tx.queryObject(
        `DELETE FROM horarios WHERE curso_periodo_id IN (SELECT id FROM cursos_periodo WHERE periodo_id = $1)`,
        [periodoId],
      );
      for (const entry of generated) {
        const cp = coursesResult.rows.find((item) => toId(item.id) === entry.cursoPeriodoId);
        const turno = cp?.turnoId ? [...turnos.values()].find((item) => toId(item.id) === toId(cp.turnoId)) : turnos.get("manana");
        if (!turno) throw new HttpError(500, "No se pudo resolver el turno del curso");
        await tx.queryObject(
          `INSERT INTO horarios
             (curso_periodo_id, materia_id, asignacion_id, maestro_id, aula_id, turno_id, dia_semana, hora_inicio, hora_fin)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [entry.cursoPeriodoId, entry.materiaId, entry.asignacionId, entry.maestroId, entry.aulaId, turno.id, entry.diaSemana, entry.horaInicio, entry.horaFin],
        );
      }
      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = true WHERE id = $1`,
        [periodoId],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al generar los horarios");
  }
  await activarAutomaticamenteSiEstaCompleta(periodoId);
  return obtenerEstadoGestion(periodoId);
}

export async function listarHorarios(
  periodoId: string,
  filters: { diaSemana?: string; cursoPeriodoId?: string; maestroId?: string; maestroUsuarioId?: string; estudianteUsuarioId?: string } = {},
): Promise<Horario[]> {
  const conditions = ["cp.periodo_id = $1", "h.estado = 'activo'"];
  const params: unknown[] = [periodoId];
  if (filters.diaSemana) {
    if (!/^[1-5]$/.test(filters.diaSemana)) throw new HttpError(400, "diaSemana debe estar entre 1 y 5");
    conditions.push(`h.dia_semana = $${params.length + 1}`);
    params.push(Number(filters.diaSemana));
  }
  if (filters.cursoPeriodoId) {
    conditions.push(`h.curso_periodo_id = $${params.length + 1}`);
    params.push(idValue(filters.cursoPeriodoId, "cursoPeriodoId"));
  }
  if (filters.maestroId) {
    const maestroId = await resolveMaestroFilterId(filters.maestroId);
    if (!maestroId) return [];
    const position = params.length + 1;
    conditions.push(`((ad.id IS NOT NULL AND ad.estado = 'activo' AND ad.maestro_id = $${position}) OR (h.asignacion_id IS NULL AND h.maestro_id = $${position}))`);
    params.push(maestroId);
  }
  if (filters.maestroUsuarioId) {
    const position = params.length + 1;
    conditions.push(`((ad.id IS NOT NULL AND ad.estado = 'activo' AND ma.usuario_id = $${position}) OR (h.asignacion_id IS NULL AND ma.usuario_id = $${position}))`);
    params.push(filters.maestroUsuarioId);
  }
  if (filters.estudianteUsuarioId) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM inscripciones i
      JOIN estudiantes e ON e.id = i.estudiante_id
      WHERE i.curso_periodo_id = h.curso_periodo_id
        AND i.periodo_id = cp.periodo_id
        AND i.estado = 'activo'
        AND e.usuario_id = $${params.length + 1}
    )`);
    params.push(filters.estudianteUsuarioId);
  }
  const result = await query<HorarioRow>(
    `SELECT h.id, h.curso_periodo_id AS "cursoPeriodoId", h.materia_id AS "materiaId",
       h.asignacion_id AS "asignacionId", COALESCE(ad.maestro_id, h.maestro_id) AS "maestroId", h.aula_id AS "aulaId",
       h.turno_id AS "turnoId", h.dia_semana AS "diaSemana", h.hora_inicio AS "horaInicio",
       h.hora_fin AS "horaFin", h.estado, c.nivel AS "cursoNivel", c.grado AS "cursoGrado",
       c.paralelo AS "cursoParalelo", t.codigo AS "turnoCodigo", t.nombre AS "turnoNombre",
       m.nombre AS "materiaNombre",
       a.nombre AS "aulaNombre", u.id AS "maestroUsuarioId", u.nombre AS "maestroNombre", u.apellido_paterno AS "maestroApellido"
     FROM horarios h
     JOIN cursos_periodo cp ON cp.id = h.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     LEFT JOIN turnos t ON t.id = h.turno_id
     JOIN materias m ON m.id = h.materia_id AND m.activo = true
     JOIN aulas a ON a.id = h.aula_id
     LEFT JOIN asignaciones_docentes ad ON ad.id = h.asignacion_id
     LEFT JOIN maestros ma ON ma.id = COALESCE(ad.maestro_id, h.maestro_id)
     LEFT JOIN usuarios u ON u.id = ma.usuario_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY h.dia_semana, h.hora_inicio, c.grado, c.paralelo`,
    params,
  );
  return result.rows.map(mapHorario);
}

export async function guardarHorariosManual(
  periodoId: string,
  input: GuardarHorarioManualInput,
): Promise<EstadoGestion> {
  await assertScheduleEditable(periodoId);
  const cpId = idValue(input.cursoPeriodoId, "cursoPeriodoId");
  const slots = input.slots ?? [];

  // paso -> validar bloques horario
  for (const slot of slots) {
    if (!slot.diaSemana || slot.diaSemana < 1 || slot.diaSemana > 5) {
      throw new HttpError(400, "diaSemana debe estar entre 1 y 5");
    }
    const hInicio = String(slot.horaInicio ?? "").slice(0, 5);
    const hFin = String(slot.horaFin ?? "").slice(0, 5);
    if (!hInicio || !hFin || hFin <= hInicio) {
      throw new HttpError(400, "Rango de horas inválido en bloque de horario");
    }
    // logica -> recreo valido contra turno
  }

  // paso -> validar solapamientos bloques
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin) {
        throw new HttpError(400, "Existen dos materias solapadas en el mismo bloque para este curso.");
      }
    }
  }

  try {
    await sTransaction(async (tx) => {
      await assertScheduleEditableTx(tx, periodoId);
      const cpRes = await tx.queryObject<{
        id: bigint;
        cursoId: bigint;
        turnoId: bigint | null;
        nivel: string;
        grado: string;
        paralelo: string;
        capacidadMaxima: number;
      }>(
        `SELECT cp.id, cp.curso_id AS "cursoId", cp.turno_id AS "turnoId", cp.capacidad_maxima AS "capacidadMaxima", c.nivel, c.grado, c.paralelo
         FROM cursos_periodo cp
         JOIN cursos c ON c.id = cp.curso_id
         WHERE cp.id = $1 AND cp.periodo_id = $2 AND cp.estado = 'activo'`,
        [cpId, periodoId],
      );
      if (!cpRes.rows.length) {
        throw new HttpError(404, "Curso del periodo no encontrado o inactivo");
      }
      const course = cpRes.rows[0];
      const turnos = await ensureTurnos(tx);
      const turno = course.turnoId
        ? [...turnos.values()].find((t) => toId(t.id) === toId(course.turnoId))
        : turnos.get("manana");
      if (!turno) throw new HttpError(500, "No se pudo resolver el turno del curso");
      const recesoInicio = String(turno.recesoInicio).slice(0, 5);
      const recesoFin = String(turno.recesoFin).slice(0, 5);
      for (const slot of slots) {
        const hInicio = String(slot.horaInicio ?? "").slice(0, 5);
        const hFin = String(slot.horaFin ?? "").slice(0, 5);
        if (hInicio < String(turno.horaInicio).slice(0, 5) || hFin > String(turno.horaFin).slice(0, 5)) {
          throw new HttpError(400, "El bloque está fuera del turno del curso");
        }
        if (hInicio < recesoFin && hFin > recesoInicio) {
          throw new HttpError(400, `El recreo de ${recesoInicio} a ${recesoFin} queda bloqueado de forma fija.`);
        }
      }
      const aulas = await ensureAulas(tx);
      const aulaPorSlot = new Map<number, string>();
      const resolverAula = async (slot: (typeof slots)[number], slotIndex: number): Promise<string> => {
        const candidatos = slot.aulaId
          ? aulas.filter((aula) => toId(aula.id) === idValue(slot.aulaId, "aulaId") && Number(aula.capacidad) >= Number(course.capacidadMaxima))
          : aulas.filter((aula) => Number(aula.capacidad) >= Number(course.capacidadMaxima));
        if (!candidatos.length) {
          throw new HttpError(409, "No existe un aula activa con capacidad suficiente para el curso");
        }
        for (const aula of candidatos) {
          const classroomConflict = await tx.queryObject<{ id: bigint }>(
            `SELECT h.id
             FROM horarios h
             JOIN cursos_periodo cp ON cp.id = h.curso_periodo_id
             WHERE cp.periodo_id = $1
               AND h.curso_periodo_id <> $2
               AND h.aula_id = $3::bigint
               AND h.dia_semana = $4
               AND h.hora_inicio < $5
               AND h.hora_fin > $6
               AND h.estado = 'activo'
             LIMIT 1`,
            [periodoId, cpId, aula.id, slot.diaSemana, slot.horaFin, slot.horaInicio],
          );
          if (!classroomConflict.rows.length) {
            const resolved = toId(aula.id);
            aulaPorSlot.set(slotIndex, resolved);
            return resolved;
          }
        }
        throw new HttpError(409, "No hay aulas disponibles sin conflicto para el bloque seleccionado");
      };

      // paso -> resolver docentes validar choque
      const resolvedTeacherIds = new Map<string, string | null>();
      const teacherByMateria = new Map<string, string>();
      const resolveTeacherId = async (raw: string): Promise<string | null> => {
        if (resolvedTeacherIds.has(raw)) return resolvedTeacherIds.get(raw) ?? null;
        let teacher = await tx.queryObject<{ id: bigint }>(
          `SELECT id FROM maestros WHERE usuario_id = $1::bigint AND estado = 'activo' LIMIT 1`,
          [raw],
        );
        if (!teacher.rows.length) {
          teacher = await tx.queryObject<{ id: bigint }>(
            `SELECT id FROM maestros WHERE id = $1::bigint AND estado = 'activo' LIMIT 1`,
            [raw],
          );
        }
        const resolved = teacher.rows[0] ? toId(teacher.rows[0].id) : null;
        resolvedTeacherIds.set(raw, resolved);
        return resolved;
      };

      for (const [slotIndex, slot] of slots.entries()) {
        const materiaId = idValue(slot.materiaId, "materiaId");
        const materiaEnMalla = await tx.queryObject<{ id: bigint }>(
          `SELECT id FROM mallas_curriculares
            WHERE periodo_id = $1::bigint AND nivel = $2 AND grado = $3
              AND materia_id = $4::bigint AND activo = true
            LIMIT 1`,
          [periodoId, course.nivel, course.grado, materiaId],
        );
        if (!materiaEnMalla.rows.length) {
          throw new HttpError(409, "La materia seleccionada no pertenece a la malla curricular de este curso");
        }

        if (!slot.maestroId) {
          throw new HttpError(400, "Cada bloque del horario debe tener un docente asignado");
        }
        const maestroIdRaw = String(slot.maestroId).trim();
        const resolvedTeacherId = await resolveTeacherId(maestroIdRaw);
        if (!resolvedTeacherId) {
          throw new HttpError(400, `El docente ${maestroIdRaw} no existe o está inactivo`);
        }
        const previousTeacher = teacherByMateria.get(materiaId);
        if (previousTeacher && previousTeacher !== resolvedTeacherId) {
          throw new HttpError(409, "Una materia no puede tener dos docentes en el mismo curso");
        }
        teacherByMateria.set(materiaId, resolvedTeacherId);
        const teacherMateria = await tx.queryObject<{ configurado: boolean; permitida: boolean }>(
          `SELECT
             COALESCE(ma.materias_configuradas, false) AS "configurado",
             EXISTS (SELECT 1 FROM maestro_materias WHERE maestro_id = $1::bigint AND materia_id = $2::bigint) AS "permitida"
           FROM maestros ma
           WHERE ma.id = $1::bigint`,
          [resolvedTeacherId, materiaId],
        );
        if (teacherMateria.rows[0]?.configurado && !teacherMateria.rows[0].permitida) {
          throw new HttpError(409, "El docente no está habilitado para impartir la materia seleccionada");
        }
        const overlap = await tx.queryObject<{
          maestroNombre: string;
          maestroApellido: string;
          cursoGrado: string;
          cursoParalelo: string;
          cursoNivel: string;
          materiaNombre: string;
        }>(
          `SELECT u.nombre AS "maestroNombre", u.apellido_paterno AS "maestroApellido",
                  c.grado AS "cursoGrado", c.paralelo AS "cursoParalelo", c.nivel AS "cursoNivel",
                  m.nombre AS "materiaNombre"
           FROM horarios h
           JOIN cursos_periodo cp ON cp.id = h.curso_periodo_id
           JOIN cursos c ON c.id = cp.curso_id
           JOIN materias m ON m.id = h.materia_id
           JOIN maestros ma ON ma.id = h.maestro_id
           JOIN usuarios u ON u.id = ma.usuario_id
           WHERE cp.periodo_id = $1
             AND h.curso_periodo_id <> $2
             AND h.maestro_id = $3::bigint
             AND h.dia_semana = $4
             AND h.hora_inicio < $5
             AND h.hora_fin > $6
             AND h.estado = 'activo'
           LIMIT 1`,
          [periodoId, cpId, resolvedTeacherId, slot.diaSemana, slot.horaFin, slot.horaInicio],
        );

        if (overlap.rows.length > 0) {
          const o = overlap.rows[0];
          const profName = `${o.maestroNombre ?? ""} ${o.maestroApellido ?? ""}`.trim();
          const cursoLabel = `${o.cursoGrado} ${o.cursoParalelo}`.trim();
          throw new HttpError(
            409,
            `El profesor ${profName} ya está asignado en este horario en el curso ${cursoLabel} impartiendo la materia ${o.materiaNombre}.`,
          );
        }
        await resolverAula(slot, slotIndex);
      }

      // paso -> reemplazar horario curso
      await tx.queryObject(
        `UPDATE asignaciones_docentes
         SET estado = 'cancelado', fecha_finalizacion = NOW()
         WHERE curso_periodo_id = $1 AND estado = 'activo'`,
        [cpId],
      );
      await tx.queryObject(`DELETE FROM horarios WHERE curso_periodo_id = $1`, [cpId]);

      // paso -> insertar nuevos horarios
      for (const [slotIndex, slot] of slots.entries()) {
        const matId = idValue(slot.materiaId, "materiaId");
        let maestroDbId: string | null = null;
        let asigId: string | null = null;

        if (slot.maestroId) {
          const mIdRaw = String(slot.maestroId).trim();
          maestroDbId = await resolveTeacherId(mIdRaw);
          if (maestroDbId) {
            // logica -> upsert asignacion docente
            const asigRes = await tx.queryObject<{ id: bigint }>(
              `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
               VALUES ($1, $2, $3, 'activo')
               ON CONFLICT (maestro_id, materia_id, curso_periodo_id) DO UPDATE SET estado = 'activo'
               RETURNING id`,
              [maestroDbId, matId, cpId],
            );
            if (asigRes.rows.length) asigId = toId(asigRes.rows[0].id);
          }
        }

        const aulaFinalId = aulaPorSlot.get(slotIndex);
        if (!aulaFinalId) {
          throw new HttpError(409, "No se pudo asignar un aula para el bloque del horario");
        }

        await tx.queryObject(
          `INSERT INTO horarios
             (curso_periodo_id, materia_id, asignacion_id, maestro_id, aula_id, turno_id, dia_semana, hora_inicio, hora_fin, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'activo')`,
          [
            cpId,
            matId,
            asigId ? asigId : null,
            maestroDbId ? maestroDbId : null,
            aulaFinalId,
            turno.id,
            slot.diaSemana,
            slot.horaInicio,
            slot.horaFin,
          ],
        );
      }

      await tx.queryObject(
        `UPDATE periodos_academicos SET horarios_generados = true WHERE id = $1`,
        [periodoId],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al guardar el horario manual");
  }
  await activarAutomaticamenteSiEstaCompleta(periodoId);
  return obtenerEstadoGestion(periodoId);
}
