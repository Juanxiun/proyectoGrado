import type { Transaction } from "@db/postgres";
import { query, sTransaction } from "../../connects/Database/transaction.ts";
import type {
  CodigoTurno,
  CreatePeriodoInput,
  EstadoGestion,
  NivelEducativo,
  PeriodoAcademico,
  Trimestre,
} from "../../models/academic.ts";
import { HttpError, mapDbError } from "../../utils/errors.ts";
import { asDateString, toId } from "../../utils/serialize.ts";
import { notifyStudentsOfEnrollmentOpening } from "../gestionNotification.service.ts";
import {
  asTime,
  ensureTurnos,
  getPeriodoRow,
  idValue,
  insertTrimestres,
  mapPeriodo,
  normalizePeriodDates,
  type AsignacionRow,
  type CursoPeriodoRow,
  type TurnoRow,
} from "./shared.ts";

// periodos -> creación, detalle, estado y activación de gestiones académicas
async function cloneStructure(
  tx: Transaction,
  sourcePeriodoId: string,
  targetPeriodoId: string,
  targetInicio: string,
  targetFin: string,
  turnos: Map<CodigoTurno, TurnoRow>,
): Promise<number> {
  const source = await tx.queryObject<CursoPeriodoRow>(
    `SELECT cp.id, cp.curso_id AS "cursoId", cp.periodo_id AS "periodoId",
       c.nivel, c.grado, c.paralelo, cp.turno_id AS "turnoId",
       cp.capacidad_maxima AS "capacidadMaxima"
     FROM cursos_periodo cp
     JOIN cursos c ON c.id = cp.curso_id
     WHERE cp.periodo_id = $1 AND cp.estado = 'activo'
     ORDER BY c.nivel, c.grado, c.paralelo`,
    [sourcePeriodoId],
  );
  const mapping = new Map<string, string>();
  for (const row of source.rows) {
    const sourceTurno = row.turnoId
      ? [...turnos.values()].find((turno) => toId(turno.id) === toId(row.turnoId))
      : undefined;
    const turno = sourceTurno ?? turnos.get("manana");
    const result = await tx.queryObject<{ id: bigint }>(
      `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, turno_id, estado)
       VALUES ($1, $2, $3, $4, 'activo')
       ON CONFLICT (curso_id, periodo_id) DO UPDATE SET
         capacidad_maxima = EXCLUDED.capacidad_maxima,
         turno_id = EXCLUDED.turno_id
       RETURNING id`,
      [row.cursoId, targetPeriodoId, row.capacidadMaxima, turno?.id ?? null],
    );
    mapping.set(toId(row.id), toId(result.rows[0].id));
  }

  const mallas = await tx.queryObject<{
    nivel: NivelEducativo;
    grado: string;
    materiaId: bigint;
    tipoMateria: "principal" | "extracurricular";
    cargaHorariaSemanal: number;
    pesoSintactico: number;
  }>(
    `SELECT nivel, grado, materia_id AS "materiaId", tipo_materia AS "tipoMateria",
       carga_horaria_semanal AS "cargaHorariaSemanal", peso_sintactico AS "pesoSintactico"
     FROM mallas_curriculares mc
     JOIN materias m ON m.id = mc.materia_id AND m.activo = true
     WHERE mc.periodo_id = $1 AND mc.activo = true`, 
    [sourcePeriodoId],
  );
  for (const malla of mallas.rows) {
    await tx.queryObject(
      `INSERT INTO mallas_curriculares
         (periodo_id, nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, peso_sintactico)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (periodo_id, nivel, grado, materia_id) DO UPDATE SET
         tipo_materia = EXCLUDED.tipo_materia,
         carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
         peso_sintactico = EXCLUDED.peso_sintactico`,
      [targetPeriodoId, malla.nivel, malla.grado, malla.materiaId, malla.tipoMateria, malla.cargaHorariaSemanal, malla.pesoSintactico],
    );
  }

  const assignments = await tx.queryObject<AsignacionRow>(
    `SELECT ad.id, ad.curso_periodo_id AS "cursoPeriodoId", ad.materia_id AS "materiaId",
       ad.maestro_id AS "maestroId", ad.estado,
           COALESCE(m.materias_configuradas, false) AS "materiasConfiguradas",
           EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = ad.materia_id) AS "materiaPermitida"
     FROM asignaciones_docentes ad
     JOIN maestros m ON m.id = ad.maestro_id
     WHERE ad.curso_periodo_id IN
       (SELECT id FROM cursos_periodo WHERE periodo_id = $1)
       AND ad.estado = 'activo' AND m.estado = 'activo'`,
    [sourcePeriodoId],
  );
  for (const assignment of assignments.rows) {
    const targetCoursePeriodo = mapping.get(toId(assignment.cursoPeriodoId));
    if (!targetCoursePeriodo) continue;
    await tx.queryObject(
      `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
       VALUES ($1, $2, $3, 'activo')
       ON CONFLICT (maestro_id, materia_id, curso_periodo_id) DO NOTHING`,
      [assignment.maestroId, assignment.materiaId, targetCoursePeriodo],
    );
  }

  const advisors = await tx.queryObject<{ cursoPeriodoId: bigint; maestroId: bigint; fechaInicio: Date | string; fechaFin: Date | string | null }>(
    `SELECT curso_periodo_id AS "cursoPeriodoId", maestro_id AS "maestroId", fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin"
     FROM curso_asesor ca
     JOIN maestros ma ON ma.id = ca.maestro_id AND ma.estado = 'activo'
     WHERE ca.curso_periodo_id IN (SELECT id FROM cursos_periodo WHERE periodo_id = $1)`, 
    [sourcePeriodoId],
  );
  for (const advisor of advisors.rows) {
    const targetCoursePeriodo = mapping.get(toId(advisor.cursoPeriodoId));
    if (!targetCoursePeriodo) continue;
    await tx.queryObject(
      `INSERT INTO curso_asesor (curso_periodo_id, maestro_id, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (curso_periodo_id) DO NOTHING`,
      [targetCoursePeriodo, advisor.maestroId, targetInicio, targetFin],
    );
  }

  await tx.queryObject(
    `UPDATE periodos_academicos SET estructura_generada = $2, estado = 'configuracion' WHERE id = $1`,
    [targetPeriodoId, source.rows.length > 0],
  );
  return source.rows.length;
}

export async function crearGestionPeriodo(input: CreatePeriodoInput): Promise<PeriodoAcademico> {
  if (input.activo !== undefined && typeof input.activo !== "boolean") {
    throw new HttpError(400, "activo debe ser booleano");
  }
  if (input.activo === true) {
    throw new HttpError(400, "Una gestión se activa únicamente después de completar y validar estructura, horarios y plan de pagos");
  }
  const normalized = normalizePeriodDates(input);
  const sourceId = input.periodoOrigenId ? idValue(input.periodoOrigenId, "periodoOrigenId") : null;
  if (input.modo === "clone" && !sourceId) {
    throw new HttpError(400, "periodoOrigenId es obligatorio para clonar una gestión");
  }

  let newId = "";
  try {
    newId = await sTransaction(async (tx) => {
      if (sourceId) {
        const source = await tx.queryObject<{ id: bigint }>(
          `SELECT id FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
          [sourceId],
        );
        if (!source.rows.length) throw new HttpError(404, `Gestión origen id=${sourceId} no encontrada`);
      }
      const result = await tx.queryObject<{ id: bigint }>(
        `INSERT INTO periodos_academicos
           (anio, nombre, fecha_inicio, fecha_fin, inicio_gestion, fin_gestion, estado, origen_periodo_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'configuracion', $7)
         RETURNING id`,
        [normalized.anio, normalized.nombre, normalized.inicio, normalized.fin, normalized.inicio, normalized.fin, sourceId],
      );
      const targetId = toId(result.rows[0].id);
      await insertTrimestres(tx, targetId, normalized.trimestres);
      if (sourceId) {
        const turnos = await ensureTurnos(tx);
        await cloneStructure(tx, sourceId, targetId, normalized.inicio, normalized.fin, turnos);
      }
      return targetId;
    });
  } catch (err) {
    throw mapDbError(err, "Error al crear la gestión académica");
  }
  return getPeriodoDetalle(newId);
}

export async function getPeriodoDetalle(id: string): Promise<PeriodoAcademico> {
  const periodo = mapPeriodo(await getPeriodoRow(id));
  const result = await query<{
    id: bigint;
    periodoId: bigint;
    numero: 1 | 2 | 3;
    inicio: Date | string;
    fin: Date | string;
  }>(
    `SELECT id, periodo_id AS "periodoId", numero, inicio, fin
     FROM trimestres WHERE periodo_id = $1 ORDER BY numero`,
    [id],
  );
  return {
    ...periodo,
    trimestres: result.rows.map((row) => ({
      id: toId(row.id),
      periodoId: toId(row.periodoId),
      numero: row.numero,
      inicio: asDateString(row.inicio),
      fin: asDateString(row.fin),
    })),
  };
}

export async function listarTrimestres(periodoId: string): Promise<Trimestre[]> {
  const result = await query<{ id: bigint; periodoId: bigint; numero: 1 | 2 | 3; inicio: Date | string; fin: Date | string }>(
    `SELECT id, periodo_id AS "periodoId", numero, inicio, fin FROM trimestres WHERE periodo_id = $1 ORDER BY numero`,
    [periodoId],
  );
  return result.rows.map((row) => ({ id: toId(row.id), periodoId: toId(row.periodoId), numero: row.numero, inicio: asDateString(row.inicio), fin: asDateString(row.fin) }));
}

function scheduleConflicts(entries: Array<{ cursoPeriodoId: string; maestroId?: string | null; aulaId: string; diaSemana: number; horaInicio: string; horaFin: string; materiaPesada?: boolean }>): string[] {
  const conflicts: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const left = entries[i];
      const right = entries[j];
      const sameBlock = left.diaSemana === right.diaSemana && left.horaInicio < right.horaFin && right.horaInicio < left.horaFin;
      if (!sameBlock) continue;
      if (left.cursoPeriodoId === right.cursoPeriodoId) conflicts.push(`Paralelo ${left.cursoPeriodoId} tiene materias traslapadas`);
      if (left.maestroId && left.maestroId === right.maestroId) conflicts.push(`Docente ${left.maestroId} tiene clases traslapadas`);
      if (left.aulaId === right.aulaId) conflicts.push(`Aula ${left.aulaId} está ocupada en dos clases`);
    }
  }
  const heavyByDay = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.materiaPesada) continue;
    const key = `${entry.cursoPeriodoId}:${entry.diaSemana}`;
    heavyByDay.set(key, (heavyByDay.get(key) ?? 0) + 1);
  }
  for (const [key, count] of heavyByDay) {
    if (count > 2) conflicts.push(`El paralelo ${key.split(':')[0]} tiene ${count} materias pesadas el mismo día`);
  }
  return [...new Set(conflicts)];
}

export async function obtenerEstadoGestion(id: string): Promise<EstadoGestion> {
  const periodo = await getPeriodoDetalle(id);
  const [courses, schedules, plans, mallas, courseLevels, coverage] = await Promise.all([
    query<{ count: string; sinTurno: string; sinMalla: string; sinHorario: string }>(
      `SELECT COUNT(*) AS count,
          COUNT(*) FILTER (WHERE cp.turno_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM turnos t WHERE t.id = cp.turno_id AND t.activo = true
          )) AS "sinTurno",
          COUNT(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM mallas_curriculares mc
            JOIN materias ma ON ma.id = mc.materia_id AND ma.activo = true
            WHERE mc.periodo_id = cp.periodo_id AND mc.nivel = c.nivel
              AND mc.grado = c.grado AND mc.activo = true
          )) AS "sinMalla",
          COUNT(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM horarios h
            JOIN materias mh ON mh.id = h.materia_id AND mh.activo = true
            WHERE h.curso_periodo_id = cp.id AND h.estado = 'activo'
          )) AS "sinHorario"
       FROM cursos_periodo cp JOIN cursos c ON c.id = cp.curso_id
       WHERE cp.periodo_id = $1 AND cp.estado = 'activo'`,
      [id],
    ),
    query<{ id: bigint; cursoPeriodoId: bigint; maestroId: bigint | null; aulaId: bigint; diaSemana: number; horaInicio: string; horaFin: string; materiaPesada: boolean }>(
      `SELECT h.id, h.curso_periodo_id AS "cursoPeriodoId", h.maestro_id AS "maestroId",
         h.aula_id AS "aulaId", h.dia_semana AS "diaSemana", h.hora_inicio AS "horaInicio", h.hora_fin AS "horaFin",
         m.materia_pesada AS "materiaPesada"
       FROM horarios h
       JOIN materias m ON m.id = h.materia_id AND m.activo = true
       WHERE h.curso_periodo_id IN (SELECT id FROM cursos_periodo WHERE periodo_id = $1) AND h.estado = 'activo'`,
      [id],
    ),
    query<{ nivel: string }>(`SELECT nivel FROM planes_pago WHERE periodo_id = $1 AND estado = 'generado'`, [id]),
    query<{ count: string; invalidExtra: string }>(
      `SELECT COUNT(*) AS count,
          COUNT(*) FILTER (WHERE mc.tipo_materia = 'extracurricular' AND mc.peso_sintactico >= 3) AS "invalidExtra"
       FROM mallas_curriculares mc
       JOIN materias ma ON ma.id = mc.materia_id AND ma.activo = true
       WHERE mc.periodo_id = $1 AND mc.activo = true`,
      [id],
    ),
    query<{ nivel: string }>(
      `SELECT DISTINCT c.nivel
       FROM cursos_periodo cp JOIN cursos c ON c.id = cp.curso_id
       WHERE cp.periodo_id = $1 AND cp.estado = 'activo'`,
      [id],
    ),
    query<{ esperado: string; actual: string; unassigned: string }>(
      `SELECT
         GREATEST(
           (SELECT COALESCE(SUM(mc.carga_horaria_semanal), 0)
            FROM mallas_curriculares mc
            JOIN materias ma ON ma.id = mc.materia_id AND ma.activo = true
            WHERE mc.periodo_id = cp.periodo_id AND mc.nivel = c.nivel
              AND mc.grado = c.grado AND mc.activo = true),
           CASE WHEN NOT EXISTS (
             SELECT 1 FROM mallas_curriculares mc
             JOIN materias ma ON ma.id = mc.materia_id AND ma.activo = true
             WHERE mc.periodo_id = cp.periodo_id AND mc.nivel = c.nivel
               AND mc.grado = c.grado AND mc.activo = true
           ) THEN (
             SELECT COUNT(DISTINCT ad.materia_id) * 5
             FROM asignaciones_docentes ad
             JOIN maestros mh ON mh.id = ad.maestro_id AND mh.estado = 'activo'
             WHERE ad.curso_periodo_id = cp.id AND ad.estado = 'activo'
           ) ELSE 0 END
         ) AS esperado,
         (SELECT COUNT(*)
          FROM horarios h
          JOIN materias mh ON mh.id = h.materia_id AND mh.activo = true
          WHERE h.curso_periodo_id = cp.id AND h.estado = 'activo') AS actual,
         (SELECT COUNT(*)
          FROM mallas_curriculares mc
          JOIN materias ma ON ma.id = mc.materia_id AND ma.activo = true
          WHERE mc.periodo_id = cp.periodo_id AND mc.nivel = c.nivel
            AND mc.grado = c.grado AND mc.activo = true
            AND NOT EXISTS (
              SELECT 1 FROM asignaciones_docentes ad
              JOIN maestros mh ON mh.id = ad.maestro_id AND mh.estado = 'activo'
              WHERE ad.curso_periodo_id = cp.id AND ad.materia_id = mc.materia_id
                AND ad.estado = 'activo'
            )
         ) AS unassigned
       FROM cursos_periodo cp
       JOIN cursos c ON c.id = cp.curso_id
       WHERE cp.periodo_id = $1 AND cp.estado = 'activo'`,
      [id],
    ),
  ]);
  const totalCursos = Number(courses.rows[0]?.count ?? 0);
  const sinTurno = Number(courses.rows[0]?.sinTurno ?? 0);
  const sinMalla = Number(courses.rows[0]?.sinMalla ?? 0);
  const sinHorario = Number(courses.rows[0]?.sinHorario ?? 0);
  const totalHorarios = schedules.rows.length;
  const incompletos = coverage.rows.filter((row) => Number(row.actual) < Number(row.esperado)).length;
  const mallasSinDocente = coverage.rows.reduce((total, row) => total + Number(row.unassigned), 0);
  const totalPlanes = plans.rows.length;
  const planLevels = new Set(plans.rows.map((row) => row.nivel));
  const missingPaymentLevels = !planLevels.has("general")
    ? courseLevels.rows.map((row) => row.nivel).filter((nivel) => !planLevels.has(nivel))
    : [];
  const totalMallas = Number(mallas.rows[0]?.count ?? 0);
  const invalidExtra = Number(mallas.rows[0]?.invalidExtra ?? 0);
  const conflicts = scheduleConflicts(schedules.rows.map((row) => ({
    cursoPeriodoId: toId(row.cursoPeriodoId),
    maestroId: row.maestroId ? toId(row.maestroId) : null,
    aulaId: toId(row.aulaId),
    diaSemana: Number(row.diaSemana),
    horaInicio: asTime(row.horaInicio),
    horaFin: asTime(row.horaFin),
    materiaPesada: Boolean(row.materiaPesada),
  })));
  const bloqueos: string[] = [];
  if (periodo.estado === "activo") {
    const activeBlockers = [...conflicts];
    if (!periodo.estructuraGenerada) activeBlockers.push("La estructura no está marcada como generada");
    if (!periodo.horariosGenerados) activeBlockers.push("Los horarios no están marcados como generados");
    if (!periodo.planPagosGenerado) activeBlockers.push("El plan de pagos no está marcado como generado");
    if (!totalCursos || sinTurno || sinMalla || sinHorario || incompletos || mallasSinDocente || !totalPlanes || missingPaymentLevels.length) {
      activeBlockers.push("La gestión activa tiene inconsistencias de configuración");
    }
    return {
      ...periodo,
      totalCursos,
      totalHorarios,
      totalPlanes,
      conflictos: conflicts,
      listoParaActivar: activeBlockers.length === 0,
      bloqueos: activeBlockers,
    };
  }
  if (periodo.finGestion < new Date().toISOString().slice(0, 10)) bloqueos.push("La fecha final de la gestión ya venció");
  if (!periodo.trimestres || periodo.trimestres.length !== 3) bloqueos.push("Deben estar definidos los tres trimestres");
  if (!periodo.estructuraGenerada) bloqueos.push("La estructura de cursos y materias aún no ha sido generada");
  if (!periodo.planPagosGenerado) bloqueos.push("La autogeneración del plan de pagos aún no está completa");
  if (!totalCursos || sinTurno) bloqueos.push("Todos los cursos deben tener un turno asignado");
  if (!totalMallas || sinMalla) bloqueos.push("Todos los cursos deben tener una malla curricular activa");
  if (invalidExtra) bloqueos.push("Las materias extracurriculares deben tener peso sintáctico menor");
  if (!totalPlanes) bloqueos.push("Debe generarse el plan de pagos");
  if (missingPaymentLevels.length) {
    bloqueos.push(`Faltan planes de pago para: ${missingPaymentLevels.join(", ")}`);
  }
  bloqueos.push(...conflicts);
  return {
    ...periodo,
    totalCursos,
    totalHorarios,
    totalPlanes,
    conflictos: conflicts,
    listoParaActivar: bloqueos.length === 0,
    bloqueos,
  };
}

export async function desactivarGestion(id: string): Promise<EstadoGestion> {
  try {
    await sTransaction(async (tx) => {
      const current = await tx.queryObject<{ estado: string; activo: boolean }>(
        `SELECT estado, activo FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!current.rows.length) throw new HttpError(404, `Gestión id=${id} no encontrada`);
      if (["cerrado", "cancelado"].includes(current.rows[0].estado)) {
        throw new HttpError(409, `No se puede desactivar una gestión ${current.rows[0].estado}`);
      }
      await tx.queryObject(
        `UPDATE periodos_academicos
         SET activo = false,
             estado = CASE WHEN estado = 'activo' THEN 'configuracion' ELSE estado END
         WHERE id = $1`,
        [id],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al desactivar la gestión académica");
  }
  return obtenerEstadoGestion(id);
}

export async function activarGestion(id: string): Promise<EstadoGestion> {
  const estado = await obtenerEstadoGestion(id);
  if (estado.estado === "activo") return estado;
  if (estado.estado === "cerrado" || estado.estado === "cancelado") {
    throw new HttpError(409, `No se puede reactivar una gestión ${estado.estado}`);
  }
  if (!estado.listoParaActivar) {
    throw new HttpError(409, `No se puede activar la gestión: ${estado.bloqueos.join("; ")}`);
  }
  try {
    await sTransaction(async (tx) => {
      const locked = await tx.queryObject<{ id: bigint; estado: string; estructuraGenerada: boolean; horariosGenerados: boolean; planPagosGenerado: boolean }>(
        `SELECT id, estado, estructura_generada AS "estructuraGenerada",
           horarios_generados AS "horariosGenerados", plan_pagos_generado AS "planPagosGenerado"
         FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!locked.rows.length) throw new HttpError(404, `Gestión id=${id} no encontrada`);
      if (locked.rows[0].estado === "activo") return;
      if (!locked.rows[0].estructuraGenerada || !locked.rows[0].planPagosGenerado) {
        throw new HttpError(409, "La estructura académica y el plan de pagos deben estar configurados antes de activar las inscripciones");
      }
      await tx.queryObject(
        `UPDATE periodos_academicos SET activo = false, estado = 'cerrado' WHERE activo = true AND id <> $1`,
        [id],
      );
      await tx.queryObject(
        `UPDATE periodos_academicos SET activo = true, estado = 'activo', activado_at = NOW() WHERE id = $1`,
        [id],
      );
      // logica -> no reabrir offerings cerrados
    });
  } catch (err) {
    throw mapDbError(err, "Error al activar la gestión académica");
  }
  return obtenerEstadoGestion(id);
}

export async function activarAutomaticamenteSiEstaCompleta(periodoId: string): Promise<void> {
  const estado = await obtenerEstadoGestion(periodoId);
  if (estado.estado === "activo" || !estado.estructuraGenerada || !estado.horariosGenerados || !estado.planPagosGenerado) return;
  if (estado.conflictos.length > 0 || estado.totalCursos === 0 || estado.totalHorarios === 0) return;

  const missingSchedules = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM cursos_periodo cp
     WHERE cp.periodo_id = $1 AND cp.estado = 'activo'
       AND NOT EXISTS (
         SELECT 1 FROM horarios h
         WHERE h.curso_periodo_id = cp.id AND h.estado = 'activo'
       )`,
    [periodoId],
  );
  if (Number(missingSchedules.rows[0]?.count ?? 0) > 0) return;
  await activarGestion(periodoId);
  await notifyStudentsOfEnrollmentOpening(periodoId, estado.nombre, estado.anio);
}
