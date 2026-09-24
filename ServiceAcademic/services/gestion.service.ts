import type { Transaction } from "@db/postgres";
import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  type Aula,
  type CodigoTurno,
  type EstadoGestion,
  type EstadoPeriodo,
  type EstructuraNivelInput,
  type GenerarEstructuraInput,
  type GenerarHorariosInput,
  type GenerarPlanPagoInput,
  type Horario,
  type MallaCurricular,
  type MallaCurricularInput,
  type NivelEducativo,
  type PeriodoAcademico,
  type PlanPago,
  type Trimestre,
  type TrimestreInput,
  type CreatePeriodoInput,
  type GuardarHorarioManualInput,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";
import {
  buildInstallments,
  countManagementMonths,
  distributeInstallmentAmounts,
  validateGestionRange,
  validateIsoDate,
  validateTrimestres,
} from "../utils/gestionValidation.ts";
import {
  buildShiftSlots,
  generateSchedule,
  type ScheduleCourse,
  type ScheduleSession,
} from "../utils/horarioAlgoritmo.ts";
import { notifyStudentsOfEnrollmentOpening } from "./gestionNotification.service.ts";

interface PeriodoRow {
  id: bigint;
  anio: number;
  nombre: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  inicioGestion?: Date | string;
  finGestion?: Date | string;
  estado?: string;
  origenPeriodoId?: bigint | null;
  estructuraGenerada?: boolean;
  horariosGenerados?: boolean;
  planPagosGenerado?: boolean;
  activo: boolean;
  fechaCreacion: Date | string;
}

interface TurnoRow {
  id: bigint;
  codigo: CodigoTurno;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  recesoInicio: string;
  recesoFin: string;
  duracionPeriodoMinutos: number;
}

interface AulaRow {
  id: bigint;
  codigo: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
}

interface CursoPeriodoRow {
  id: bigint;
  cursoId: bigint;
  periodoId: bigint;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  turnoId: bigint | null;
  capacidadMaxima: number;
}

interface MallaRow {
  id: bigint;
  periodoId: bigint;
  nivel: NivelEducativo;
  grado: string;
  materiaId: bigint;
  tipoMateria: "principal" | "extracurricular";
  cargaHorariaSemanal: number;
  pesoSintactico: number;
  materiaNombre: string;
  materiaCodigo?: string;
  materiaPesada: boolean;
}

interface AsignacionRow {
  id: bigint;
  cursoPeriodoId: bigint;
  materiaId: bigint;
  maestroId: bigint;
  materiasConfiguradas: boolean;
  materiaPermitida: boolean;
  estado: string;
}

interface HorarioRow {
  id: bigint;
  cursoPeriodoId: bigint;
  materiaId: bigint;
  asignacionId: bigint | null;
  maestroId: bigint | null;
  aulaId: bigint;
  turnoId: bigint;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  estado: string;
  materiaNombre?: string;
  aulaNombre?: string;
  maestroNombre?: string;
  maestroApellido?: string;
  maestroUsuarioId?: bigint;
}

interface PlanRow {
  id: bigint;
  periodoId: bigint;
  nivel: string;
  nombre: string;
  cantidadCuotas: number;
  montoTotal: number;
  montoCuota: number;
  diaVencimiento: number;
  estado: string;
}

const DEFAULT_GRADES = ["1°", "2°", "3°", "4°", "5°", "6°"];
const DEFAULT_LEVELS: Array<{ nivel: NivelEducativo; grados: string[]; paralelos: Record<string, number> }> = [
  { nivel: "primaria", grados: DEFAULT_GRADES, paralelos: {} },
  { nivel: "secundaria", grados: DEFAULT_GRADES, paralelos: {} },
];

function normalizeEstado(value: unknown): EstadoPeriodo {
  const estado = String(value ?? "configuracion").toLowerCase();
  if (["borrador", "configuracion", "activo", "cerrado", "cancelado"].includes(estado)) {
    return estado as EstadoPeriodo;
  }
  return "configuracion";
}

function asTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  return String(value ?? "").slice(0, 5);
}

function mapPeriodo(row: PeriodoRow): PeriodoAcademico {
  return serialize({
    id: toId(row.id),
    anio: Number(row.anio),
    nombre: row.nombre,
    fechaInicio: asDateString(row.fechaInicio),
    fechaFin: asDateString(row.fechaFin),
    inicioGestion: asDateString(row.inicioGestion ?? row.fechaInicio),
    finGestion: asDateString(row.finGestion ?? row.fechaFin),
    estado: normalizeEstado(row.estado),
    origenPeriodoId: row.origenPeriodoId ? toId(row.origenPeriodoId) : null,
    estructuraGenerada: Boolean(row.estructuraGenerada),
    horariosGenerados: Boolean(row.horariosGenerados),
    planPagosGenerado: Boolean(row.planPagosGenerado),
    activo: Boolean(row.activo),
    fechaCreacion: asDateString(row.fechaCreacion),
  });
}

function mapAula(row: AulaRow): Aula {
  return serialize({
    id: toId(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    capacidad: Number(row.capacidad),
    activa: Boolean(row.activa),
  });
}

function mapHorario(row: HorarioRow): Horario {
  return serialize({
    id: toId(row.id),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    materiaId: toId(row.materiaId),
    asignacionId: row.asignacionId ? toId(row.asignacionId) : null,
    maestroId: row.maestroId ? toId(row.maestroId) : null,
    aulaId: toId(row.aulaId),
    turnoId: toId(row.turnoId),
    diaSemana: Number(row.diaSemana),
    horaInicio: asTime(row.horaInicio),
    horaFin: asTime(row.horaFin),
    estado: row.estado,
    materia: row.materiaNombre ? { id: toId(row.materiaId), nombre: row.materiaNombre } : undefined,
    aula: row.aulaNombre ? { id: toId(row.aulaId), nombre: row.aulaNombre } : undefined,
    maestro: row.maestroId
      ? {
        id: toId(row.maestroId),
        usuarioId: row.maestroUsuarioId ? toId(row.maestroUsuarioId) : undefined,
        nombre: row.maestroNombre,
        apellidoPaterno: row.maestroApellido,
      }
      : null,
  });
}

function mapPlan(row: PlanRow): PlanPago {
  return serialize({
    id: toId(row.id),
    periodoId: toId(row.periodoId),
    nivel: row.nivel,
    nombre: row.nombre,
    cantidadCuotas: Number(row.cantidadCuotas),
    montoTotal: Number(row.montoTotal),
    montoCuota: Number(row.montoCuota),
    diaVencimiento: Number(row.diaVencimiento),
    estado: row.estado,
  });
}

function idValue(value: unknown, field: string): string {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new HttpError(400, `${field} debe ser numérico`);
  return id;
}

function validateYearAndName(anio: unknown, nombre: unknown): void {
  const year = Number(anio);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, "anio debe ser un entero entre 2000 y 2100");
  }
  if (!String(nombre ?? "").trim()) throw new HttpError(400, "nombre es obligatorio");
}

function normalizePeriodDates(input: CreatePeriodoInput): {
  anio: number;
  nombre: string;
  inicio: string;
  fin: string;
  trimestres: TrimestreInput[];
} {
  validateYearAndName(input.anio, input.nombre);
  const raw = input as CreatePeriodoInput & Record<string, unknown>;
  const inicio = String(input.inicioGestion ?? input.fechaInicio ?? raw.inicio_gestion ?? raw.fecha_inicio ?? "");
  const fin = String(input.finGestion ?? input.fechaFin ?? raw.fin_gestion ?? raw.fecha_fin ?? "");
  if (input.inicioGestion && input.fechaInicio && input.inicioGestion !== input.fechaInicio) {
    throw new HttpError(400, "fechaInicio y inicio_gestion no son consistentes");
  }
  if (input.finGestion && input.fechaFin && input.finGestion !== input.fechaFin) {
    throw new HttpError(400, "fechaFin y fin_gestion no son consistentes");
  }
  validateIsoDate(inicio, "inicio_gestion");
  validateIsoDate(fin, "fin_gestion");
  validateGestionRange(inicio, fin);
  const suppliedTrimestres = input.trimestres ?? [
    { numero: 1 as const, inicio: String(input.inicio1T ?? input.inicio1 ?? raw.inicio_1T ?? raw.inicio_1 ?? ""), fin: String(input.fin1T ?? input.fin1 ?? raw.fin_1T ?? raw.fin_1 ?? "") },
    { numero: 2 as const, inicio: String(input.inicio2T ?? input.inicio2 ?? raw.inicio_2T ?? raw.inicio_2 ?? ""), fin: String(input.fin2T ?? input.fin2 ?? raw.fin_2T ?? raw.fin_2 ?? "") },
    { numero: 3 as const, inicio: String(input.inicio3T ?? input.inicio3 ?? raw.inicio_3T ?? raw.inicio_3 ?? ""), fin: String(input.fin3T ?? input.fin3 ?? raw.fin_3T ?? raw.fin_3 ?? "") },
  ];
  validateTrimestres(inicio, fin, suppliedTrimestres);
  return { anio: Number(input.anio), nombre: String(input.nombre).trim(), inicio, fin, trimestres: suppliedTrimestres };
}

async function ensureTurnos(tx: Transaction): Promise<Map<CodigoTurno, TurnoRow>> {
  await tx.queryObject(
    `INSERT INTO turnos (codigo, nombre, hora_inicio, hora_fin, receso_inicio, receso_fin)
     VALUES
       ('manana', 'Turno Mañana', '07:00', '12:30', '09:30', '10:00'),
       ('tarde', 'Turno Tarde', '14:00', '18:30', '16:00', '16:30')
     ON CONFLICT (codigo) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       hora_inicio = EXCLUDED.hora_inicio,
       hora_fin = EXCLUDED.hora_fin,
       receso_inicio = EXCLUDED.receso_inicio,
       receso_fin = EXCLUDED.receso_fin`,
  );
  const result = await tx.queryObject<TurnoRow>(
    `SELECT id, codigo, nombre,
       hora_inicio AS "horaInicio", hora_fin AS "horaFin",
       receso_inicio AS "recesoInicio", receso_fin AS "recesoFin",
       duracion_periodo_minutos AS "duracionPeriodoMinutos"
     FROM turnos WHERE activo = true`,
  );
  return new Map(result.rows.map((row) => [row.codigo, row]));
}

async function ensureAulas(tx: Transaction, requestedIds?: string[]): Promise<AulaRow[]> {
  let result = await tx.queryObject<AulaRow>(
    `SELECT id, codigo, nombre, capacidad, activa FROM aulas WHERE activa = true ORDER BY codigo`,
  );
  if (requestedIds?.length) {
    const wanted = new Set(requestedIds.map((id) => idValue(id, "aulaId")));
    result = { rows: result.rows.filter((row) => wanted.has(toId(row.id))) } as typeof result;
    if (!result.rows.length) throw new HttpError(400, "No se encontraron aulas activas para la selección");
  }
  if (!result.rows.length) {
    const created = await tx.queryObject<AulaRow>(
      `INSERT INTO aulas (codigo, nombre, capacidad)
       VALUES ('AUTO-1', 'Aula automática 1', 30)
       ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, activa = true
       RETURNING id, codigo, nombre, capacidad, activa`,
    );
    result = created;
  }
  return result.rows;
}

async function getPeriodoRow(id: string): Promise<PeriodoRow> {
  const result = await query<PeriodoRow>(
    `SELECT id, anio, nombre,
       fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
       inicio_gestion AS "inicioGestion", fin_gestion AS "finGestion",
       estado, origen_periodo_id AS "origenPeriodoId",
       estructura_generada AS "estructuraGenerada",
       horarios_generados AS "horariosGenerados",
       plan_pagos_generado AS "planPagosGenerado",
       activo, fecha_creacion AS "fechaCreacion"
     FROM periodos_academicos WHERE id = $1`,
    [id],
  );
  if (!result.rows.length) throw new HttpError(404, `Periodo académico id=${id} no encontrado`);
  return result.rows[0];
}

async function resolveMaestroFilterId(value: string): Promise<string | null> {
  const result = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
    [value],
  );
  return result.rows.length ? toId(result.rows[0].id) : null;
}

async function assertEditable(id: string): Promise<PeriodoRow> {
  const row = await getPeriodoRow(id);
  const estado = normalizeEstado(row.estado);
  if (estado === "activo" || estado === "cerrado" || estado === "cancelado") {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no puede modificarse`);
  }
  return row;
}

async function assertEditableTx(tx: Transaction, id: string): Promise<void> {
  const result = await tx.queryObject<{ estado?: string; activo: boolean }>(
    `SELECT estado, activo FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (!result.rows.length) throw new HttpError(404, `Gestión id=${id} no encontrada`);
  const estado = normalizeEstado(result.rows[0].estado);
  if (estado === "activo" || estado === "cerrado" || estado === "cancelado" || result.rows[0].activo) {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no puede modificarse`);
  }
}

async function assertScheduleEditable(id: string): Promise<PeriodoRow> {
  const row = await getPeriodoRow(id);
  const estado = normalizeEstado(row.estado);
  if (estado === "cerrado" || estado === "cancelado") {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no permite modificar horarios`);
  }
  return row;
}

async function assertScheduleEditableTx(tx: Transaction, id: string): Promise<void> {
  const result = await tx.queryObject<{ estado?: string }>(
    `SELECT estado FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
    [id],
  );
  if (!result.rows.length) throw new HttpError(404, `Gestión id=${id} no encontrada`);
  const estado = normalizeEstado(result.rows[0].estado);
  if (estado === "cerrado" || estado === "cancelado") {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no permite modificar horarios`);
  }
}

async function insertTrimestres(tx: Transaction, periodoId: string, trimestres: TrimestreInput[]): Promise<void> {
  for (const trimestre of trimestres) {
    await tx.queryObject(
      `INSERT INTO trimestres (periodo_id, numero, inicio, fin)
       VALUES ($1, $2, $3, $4)`,
      [periodoId, trimestre.numero, trimestre.inicio, trimestre.fin],
    );
  }
}

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

export async function generarEstructura(
  periodoId: string,
  input: GenerarEstructuraInput = {},
): Promise<EstadoGestion> {
  await assertEditable(periodoId);
  const niveles: EstructuraNivelInput[] = input.niveles?.length
    ? input.niveles
    : input.paralelosPorNivel && Object.keys(input.paralelosPorNivel).length
    ? Object.entries(input.paralelosPorNivel).map(([nivel, value]) => ({
      nivel: nivel as NivelEducativo,
      grados: !Array.isArray(value) ? Object.keys(value) : undefined,
      paralelos: Array.isArray(value)
        ? Object.fromEntries(DEFAULT_GRADES.map((grade) => [grade, value.length]))
        : value,
    }))
    : DEFAULT_LEVELS;
  const normalizados = niveles.map((level) => {
    if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(level.nivel)) {
      throw new HttpError(400, `Nivel no válido: ${level.nivel}`);
    }
    return {
      nivel: level.nivel,
      grados: level.grados?.length ? level.grados : DEFAULT_LEVELS.find((item) => item.nivel === level.nivel)?.grados ?? DEFAULT_GRADES,
      paralelos: level.paralelos ?? {},
    };
  });

  const capacidadMaxima = Number(input.capacidadMaxima ?? 30);
  if (!Number.isInteger(capacidadMaxima) || capacidadMaxima < 1 || capacidadMaxima > 1000) {
    throw new HttpError(400, "capacidadMaxima debe ser un entero entre 1 y 1000");
  }
  try {
    await sTransaction(async (tx) => {
      await assertEditableTx(tx, periodoId);
      const turnos = await ensureTurnos(tx);
      for (const level of normalizados) {
        for (const grade of level.grados) {
          const count = Number(level.paralelos[grade] ?? 1);
          if (!Number.isInteger(count) || count < 1 || count > 26) {
            throw new HttpError(400, `La cantidad de paralelos de ${grade} debe estar entre 1 y 26`);
          }
          for (let index = 0; index < count; index++) {
            const parallel = String.fromCharCode(65 + index);
            const course = await tx.queryObject<{ id: bigint }>(
              `INSERT INTO cursos (nivel, grado, paralelo, capacidad_maxima)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (nivel, grado, paralelo) DO UPDATE SET capacidad_maxima = EXCLUDED.capacidad_maxima, activo = true
               RETURNING id`,
              [level.nivel, grade, parallel, capacidadMaxima],
            );
            const turnoCode = input.turnoPorCurso?.[`${level.nivel}:${grade}:${parallel}`] ?? input.turnoPorNivel?.[level.nivel] ?? "manana";
            if (turnoCode !== "manana" && turnoCode !== "tarde") {
              throw new HttpError(400, `Turno inválido para ${level.nivel} ${grade} ${parallel}`);
            }
            const turno = turnos.get(turnoCode) ?? turnos.get("manana");
            if (!turno) throw new HttpError(500, "No se pudo obtener el turno por defecto");
            await tx.queryObject<{ id: bigint }>(
              `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, turno_id, estado)
               VALUES ($1, $2, $3, $4, 'activo')
               ON CONFLICT (curso_id, periodo_id) DO UPDATE SET
                 turno_id = EXCLUDED.turno_id,
                 capacidad_maxima = EXCLUDED.capacidad_maxima,
                 estado = 'activo'
               RETURNING id`,
              [course.rows[0].id, periodoId, capacidadMaxima, turno.id],
            );
            // El offering queda listo; la matrícula se habilita al activar la gestión.
          }
        }
      }

      for (const malla of input.mallasCurriculares ?? []) {
        if (!String(malla.grado ?? "").trim()) throw new HttpError(400, "grado de malla curricular es obligatorio");
        if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(malla.nivel)) {
          throw new HttpError(400, `Nivel no válido en malla curricular: ${malla.nivel}`);
        }
        const tipoMalla = malla.tipoMateria;
        if (tipoMalla !== undefined && tipoMalla !== "principal" && tipoMalla !== "extracurricular") {
          throw new HttpError(400, "tipoMateria inválido en malla curricular");
        }
        const materiaId = idValue(malla.materiaId, "materiaId");
        const materia = await tx.queryObject<{
          tipoMateria: "principal" | "extracurricular";
          cargaHorariaSemanal: number;
          pesoSintactico: number;
        }>(
          `SELECT tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
             peso_sintactico AS "pesoSintactico"
           FROM materias WHERE id = $1 AND activo = true`,
          [materiaId],
        );
        if (!materia.rows.length) throw new HttpError(404, `Materia id=${materiaId} no encontrada o inactiva`);
        const tipo = malla.tipoMateria ?? materia.rows[0].tipoMateria;
        const carga = Number(malla.cargaHorariaSemanal ?? materia.rows[0].cargaHorariaSemanal);
        const peso = Number(malla.pesoSintactico ?? (tipo === "extracurricular" ? 1 : materia.rows[0].pesoSintactico));
        if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "La carga horaria debe estar entre 1 y 40");
        if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "El peso sintáctico debe estar entre 1 y 100");
        if (tipo === "extracurricular" && peso >= 3) throw new HttpError(400, "Las materias extracurriculares deben tener un peso sintáctico menor");
        await tx.queryObject(
          `INSERT INTO mallas_curriculares
             (periodo_id, nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, peso_sintactico)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (periodo_id, nivel, grado, materia_id) DO UPDATE SET
             tipo_materia = EXCLUDED.tipo_materia,
             carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
             peso_sintactico = EXCLUDED.peso_sintactico`,
          [periodoId, malla.nivel, malla.grado, materiaId, tipo, carga, peso],
        );
      }

      for (const assignment of input.asignaciones ?? []) {
        const cpId = idValue(assignment.cursoPeriodoId, "cursoPeriodoId");
        const materiaId = idValue(assignment.materiaId, "materiaId");
        const cp = await tx.queryObject<{ id: bigint; nivel: NivelEducativo; grado: string }>(
          `SELECT cp.id, c.nivel, c.grado
           FROM cursos_periodo cp
           JOIN cursos c ON c.id = cp.curso_id
           WHERE cp.id = $1 AND cp.periodo_id = $2`,
          [cpId, periodoId],
        );
        if (!cp.rows.length) throw new HttpError(404, `El curso ${cpId} no pertenece a la gestión`);
        const materia = await tx.queryObject<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1 AND activo = true`, [materiaId]);
        if (!materia.rows.length) throw new HttpError(404, `Materia id=${materiaId} no encontrada o inactiva`);
        const malla = await tx.queryObject<{ id: bigint }>(
          `SELECT id FROM mallas_curriculares
           WHERE periodo_id = $1 AND nivel = $2 AND grado = $3 AND materia_id = $4 AND activo = true
           LIMIT 1`,
          [periodoId, cp.rows[0].nivel, cp.rows[0].grado, materiaId],
        );
        if (!malla.rows.length) throw new HttpError(409, "La materia no pertenece a la malla curricular del curso");
        const maestroInput = idValue(assignment.maestroId, "maestroId");
        let maestro = await tx.queryObject<{ id: bigint; materiasConfiguradas: boolean; materiaPermitida: boolean }>(
          `SELECT m.id,
                  COALESCE(m.materias_configuradas, false) AS \"materiasConfiguradas\",
                  EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS \"materiaPermitida\"
           FROM maestros m WHERE m.usuario_id = $1 AND m.estado = 'activo' LIMIT 1`,
          [maestroInput, materiaId],
         );
        if (!maestro.rows.length) {
          maestro = await tx.queryObject<{ id: bigint; materiasConfiguradas: boolean; materiaPermitida: boolean }>(
            `SELECT m.id,
                    COALESCE(m.materias_configuradas, false) AS \"materiasConfiguradas\",
                    EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS \"materiaPermitida\"
             FROM maestros m WHERE m.id = $1 AND m.estado = 'activo' LIMIT 1`,
            [maestroInput, materiaId],
          );
        }
        if (!maestro.rows.length) throw new HttpError(404, "El docente no existe o está inactivo");
        if (maestro.rows[0].materiasConfiguradas && !maestro.rows[0].materiaPermitida) {
          throw new HttpError(409, "El docente no está habilitado para impartir la materia seleccionada");
        }
        await tx.queryObject(
          `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
           VALUES ($1, $2, $3, 'activo')
           ON CONFLICT (maestro_id, materia_id, curso_periodo_id) DO NOTHING`,
          [maestro.rows[0].id, materiaId, cpId],
        );
      }

      await tx.queryObject(
        `UPDATE periodos_academicos
         SET estructura_generada = true,
             horarios_generados = false,
             plan_pagos_generado = false,
             estado = CASE WHEN estado = 'borrador' THEN 'configuracion' ELSE estado END
         WHERE id = $1`,
        [periodoId],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al generar la estructura académica");
  }
  return obtenerEstadoGestion(periodoId);
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

async function activarAutomaticamenteSiEstaCompleta(periodoId: string): Promise<void> {
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

export async function generarPlanPagos(
  periodoId: string,
  input: GenerarPlanPagoInput = {},
): Promise<EstadoGestion> {
  await assertScheduleEditable(periodoId);
  const periodo = mapPeriodo(await getPeriodoRow(periodoId));
  const months = countManagementMonths(periodo.inicioGestion, periodo.finGestion);
  const dia = Number(input.diaVencimiento ?? 10);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) throw new HttpError(400, "diaVencimiento debe estar entre 1 y 28");
  const supplied = input.montosPorNivel ?? {};
  if (input.montoCuota !== undefined && (!Number.isFinite(Number(input.montoCuota)) || Number(input.montoCuota) <= 0)) {
    throw new HttpError(400, "montoCuota debe ser mayor a 0");
  }
  if (input.montoTotal !== undefined && (!Number.isFinite(Number(input.montoTotal)) || Number(input.montoTotal) <= 0)) {
    throw new HttpError(400, "montoTotal debe ser mayor a 0");
  }
  if (input.montoTotal !== undefined && Object.keys(supplied).length > 0) {
    throw new HttpError(400, "Use montosPorNivel o montoTotal, no ambos a la vez");
  }
  const defaultMonthly = input.montoCuota !== undefined
    ? Number(input.montoCuota)
    : input.montoTotal !== undefined
    ? Number(input.montoTotal) / months
    : 0;
  if (!Object.keys(supplied).length && defaultMonthly <= 0) {
    throw new HttpError(400, "Indique montoCuota, montoTotal o montosPorNivel");
  }
  if (input.montoCuota !== undefined && input.montoTotal !== undefined) {
    const expected = Number(input.montoCuota) * months;
    if (Math.abs(expected - Number(input.montoTotal)) > 0.01) {
      throw new HttpError(400, "montoCuota y montoTotal no son consistentes");
    }
  }
  try {
    await sTransaction(async (tx) => {
      await assertScheduleEditableTx(tx, periodoId);
      const courseLevels = await tx.queryObject<{ nivel: string }>(
        `SELECT DISTINCT c.nivel
         FROM cursos_periodo cp
         JOIN cursos c ON c.id = cp.curso_id
         WHERE cp.periodo_id = $1 AND cp.estado = 'activo' AND c.activo = true`,
        [periodoId],
      );
      const levels = Object.keys(supplied).length
        ? Object.keys(supplied)
        : [...new Set(courseLevels.rows.map((row) => row.nivel))];
      if (!levels.length) throw new HttpError(409, "La gestión no tiene cursos activos para generar planes de pago");
      const existingPlans = await tx.queryObject<{ nivel: string }>(
        `SELECT nivel FROM planes_pago WHERE periodo_id = $1`,
        [periodoId],
      );
      for (const existing of existingPlans.rows) {
        if (!levels.includes(existing.nivel)) {
          await tx.queryObject(`DELETE FROM planes_pago WHERE periodo_id = $1 AND nivel = $2`, [periodoId, existing.nivel]);
        }
      }
      for (const nivel of levels) {
        if (!["general", "primaria", "secundaria", "bachillerato"].includes(nivel)) {
          throw new HttpError(400, `Nivel de plan de pago inválido: ${nivel}`);
        }
        const monthly = Number(supplied[nivel as keyof typeof supplied] ?? defaultMonthly);
        if (!Number.isFinite(monthly) || monthly <= 0) throw new HttpError(400, `El monto de ${nivel} debe ser mayor a 0`);
        const targetTotal = Object.keys(supplied).length
          ? Math.round(monthly * months * 100) / 100
          : Math.round(Number(input.montoTotal ?? monthly * months) * 100) / 100;
        const installments = buildInstallments(periodo.inicioGestion, periodo.finGestion, monthly, dia);
        distributeInstallmentAmounts(installments, targetTotal);
        const monthlyDisplay = Math.round((targetTotal / months) * 100) / 100;
        const plan = await tx.queryObject<{ id: bigint }>(
          `INSERT INTO planes_pago
             (periodo_id, nivel, nombre, cantidad_cuotas, monto_total, monto_cuota, dia_vencimiento, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'generado')
           ON CONFLICT (periodo_id, nivel) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             cantidad_cuotas = EXCLUDED.cantidad_cuotas,
             monto_total = EXCLUDED.monto_total,
             monto_cuota = EXCLUDED.monto_cuota,
             dia_vencimiento = EXCLUDED.dia_vencimiento,
             estado = 'generado'
           RETURNING id`,
          [periodoId, nivel, `Plan ${nivel} ${periodo.anio}`, months, targetTotal, monthlyDisplay, dia],
        );
        const planId = plan.rows[0].id;
        await tx.queryObject(`DELETE FROM cuotas_plan_pago WHERE plan_id = $1`, [planId]);
        for (const installment of installments) {
          await tx.queryObject(
            `INSERT INTO cuotas_plan_pago (plan_id, numero, anio, mes, fecha_vencimiento, monto)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [planId, installment.numero, installment.anio, installment.mes, installment.fechaVencimiento, installment.monto],
          );
        }
      }
      await tx.queryObject(`UPDATE periodos_academicos SET plan_pagos_generado = true WHERE id = $1`, [periodoId]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al generar el plan de pagos");
  }
  await activarAutomaticamenteSiEstaCompleta(periodoId);
  return obtenerEstadoGestion(periodoId);
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
      // Los offerings se generan durante la configuración; no se reabren
      // automáticamente los que fueron cerrados o cancelados explícitamente.
    });
  } catch (err) {
    throw mapDbError(err, "Error al activar la gestión académica");
  }
  return obtenerEstadoGestion(id);
}

export async function listarTrimestres(periodoId: string): Promise<Trimestre[]> {
  const result = await query<{ id: bigint; periodoId: bigint; numero: 1 | 2 | 3; inicio: Date | string; fin: Date | string }>(
    `SELECT id, periodo_id AS "periodoId", numero, inicio, fin FROM trimestres WHERE periodo_id = $1 ORDER BY numero`,
    [periodoId],
  );
  return result.rows.map((row) => ({ id: toId(row.id), periodoId: toId(row.periodoId), numero: row.numero, inicio: asDateString(row.inicio), fin: asDateString(row.fin) }));
}

export async function listarAulas(): Promise<Aula[]> {
  const result = await query<AulaRow>(`SELECT id, codigo, nombre, capacidad, activa FROM aulas ORDER BY codigo`);
  return result.rows.map(mapAula);
}

export async function crearAula(input: { codigo: string; nombre: string; capacidad?: number }): Promise<Aula> {
  const codigo = String(input.codigo ?? "").trim().toUpperCase();
  const nombre = String(input.nombre ?? "").trim();
  const capacidad = Number(input.capacidad ?? 30);
  if (!codigo || !nombre) throw new HttpError(400, "codigo y nombre son obligatorios");
  if (!Number.isInteger(capacidad) || capacidad < 1) throw new HttpError(400, "capacidad debe ser mayor a 0");
  try {
    const result = await query<AulaRow>(
      `INSERT INTO aulas (codigo, nombre, capacidad) VALUES ($1, $2, $3)
       RETURNING id, codigo, nombre, capacidad, activa`,
      [codigo, nombre, capacidad],
    );
    return mapAula(result.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear el aula");
  }
}

export async function crearMalla(
  periodoId: string,
  input: MallaCurricularInput,
): Promise<MallaCurricular> {
  await assertEditable(periodoId);
  const materiaId = idValue(input.materiaId, "materiaId");
  const grado = String(input.grado ?? "").trim();
  if (!grado) throw new HttpError(400, "grado es obligatorio");
  if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(input.nivel)) {
    throw new HttpError(400, "nivel inválido en malla curricular");
  }
  const materia = await query<{ id: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number }>(
    `SELECT id, tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
       peso_sintactico AS "pesoSintactico"
     FROM materias WHERE id = $1 AND activo = true`,
    [materiaId],
  );
  if (!materia.rows.length) throw new HttpError(404, "La materia no existe o está inactiva");
  const tipo = input.tipoMateria ?? materia.rows[0].tipoMateria;
  if (tipo !== "principal" && tipo !== "extracurricular") throw new HttpError(400, "tipoMateria inválido");
  const carga = Number(input.cargaHorariaSemanal ?? materia.rows[0].cargaHorariaSemanal);
  const peso = Number(input.pesoSintactico ?? (tipo === "extracurricular" ? 1 : materia.rows[0].pesoSintactico));
  if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "La carga horaria debe estar entre 1 y 40");
  if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "El peso sintáctico debe estar entre 1 y 100");
  if (tipo === "extracurricular" && peso >= 3) throw new HttpError(400, "Las extracurriculares deben tener menor peso sintáctico");
  try {
    const row = await sTransaction(async (tx) => {
      await assertEditableTx(tx, periodoId);
      const result = await tx.queryObject<{ id: bigint; periodoId: bigint; nivel: NivelEducativo; grado: string; materiaId: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number; materiaCodigo: string; materiaNombre: string }>(
        `INSERT INTO mallas_curriculares
           (periodo_id, nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, peso_sintactico)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (periodo_id, nivel, grado, materia_id) DO UPDATE SET
           tipo_materia = EXCLUDED.tipo_materia,
           carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
           peso_sintactico = EXCLUDED.peso_sintactico
         RETURNING id, periodo_id AS "periodoId", nivel, grado, materia_id AS "materiaId",
           tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
           peso_sintactico AS "pesoSintactico",
           (SELECT codigo FROM materias WHERE id = $4) AS "materiaCodigo",
           (SELECT nombre FROM materias WHERE id = $4) AS "materiaNombre"`,
        [periodoId, input.nivel, grado, materiaId, tipo, carga, peso],
      );
      await tx.queryObject(
        `UPDATE periodos_academicos
         SET estructura_generada = true, horarios_generados = false, plan_pagos_generado = false
         WHERE id = $1`,
        [periodoId],
      );
      return result.rows[0];
    });
    return {
      id: toId(row.id), periodoId: toId(row.periodoId), nivel: row.nivel, grado: row.grado,
      materiaId: toId(row.materiaId), tipoMateria: row.tipoMateria,
      cargaHorariaSemanal: Number(row.cargaHorariaSemanal), pesoSintactico: Number(row.pesoSintactico),
      materia: { id: toId(row.materiaId), codigo: row.materiaCodigo, nombre: row.materiaNombre } as MallaCurricular["materia"],
    };
  } catch (err) {
    throw mapDbError(err, "Error al guardar la malla curricular");
  }
}

export async function listarMallas(periodoId: string): Promise<MallaCurricular[]> {
  const result = await query<{ id: bigint; periodoId: bigint; nivel: NivelEducativo; grado: string; materiaId: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number; materiaCodigo: string; materiaNombre: string }>(
    `SELECT mc.id, mc.periodo_id AS "periodoId", mc.nivel, mc.grado,
       mc.materia_id AS "materiaId", mc.tipo_materia AS "tipoMateria",
       mc.carga_horaria_semanal AS "cargaHorariaSemanal", mc.peso_sintactico AS "pesoSintactico",
       m.codigo AS "materiaCodigo", m.nombre AS "materiaNombre"
     FROM mallas_curriculares mc JOIN materias m ON m.id = mc.materia_id AND m.activo = true
     WHERE mc.periodo_id = $1 AND mc.activo = true ORDER BY mc.nivel, mc.grado, m.nombre`,
    [periodoId],
  );
  return result.rows.map((row) => ({
    id: toId(row.id), periodoId: toId(row.periodoId), nivel: row.nivel, grado: row.grado,
    materiaId: toId(row.materiaId), tipoMateria: row.tipoMateria,
    cargaHorariaSemanal: Number(row.cargaHorariaSemanal), pesoSintactico: Number(row.pesoSintactico),
    materia: { id: toId(row.materiaId), nombre: row.materiaNombre } as MallaCurricular["materia"],
  }));
}

export async function listarHorarios(
  periodoId: string,
  filters: { diaSemana?: string; cursoPeriodoId?: string; maestroId?: string; estudianteUsuarioId?: string } = {},
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
    conditions.push(`h.maestro_id = $${params.length + 1}`);
    params.push(maestroId);
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
       h.asignacion_id AS "asignacionId", h.maestro_id AS "maestroId", h.aula_id AS "aulaId",
       h.turno_id AS "turnoId", h.dia_semana AS "diaSemana", h.hora_inicio AS "horaInicio",
       h.hora_fin AS "horaFin", h.estado, m.nombre AS "materiaNombre",
       a.nombre AS "aulaNombre", u.id AS "maestroUsuarioId", u.nombre AS "maestroNombre", u.apellido_paterno AS "maestroApellido"
     FROM horarios h
     JOIN cursos_periodo cp ON cp.id = h.curso_periodo_id
     JOIN cursos c ON c.id = cp.curso_id
     JOIN materias m ON m.id = h.materia_id AND m.activo = true
     JOIN aulas a ON a.id = h.aula_id
     LEFT JOIN maestros ma ON ma.id = h.maestro_id
     LEFT JOIN usuarios u ON u.id = ma.usuario_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY h.dia_semana, h.hora_inicio, c.grado, c.paralelo`,
    params,
  );
  return result.rows.map(mapHorario);
}

export async function listarPlanesPago(periodoId: string): Promise<PlanPago[]> {
  const result = await query<PlanRow>(
    `SELECT id, periodo_id AS "periodoId", nivel, nombre, cantidad_cuotas AS "cantidadCuotas",
       monto_total AS "montoTotal", monto_cuota AS "montoCuota", dia_vencimiento AS "diaVencimiento", estado
     FROM planes_pago WHERE periodo_id = $1 ORDER BY nivel`,
    [periodoId],
  );
  const plans = result.rows.map(mapPlan);
  for (const plan of plans) {
    const cuotas = await query<{ id: bigint; planId: bigint; numero: number; anio: number; mes: number; fechaVencimiento: Date | string; monto: number; estado: string }>(
      `SELECT id, plan_id AS "planId", numero, anio, mes, fecha_vencimiento AS "fechaVencimiento", monto, estado
       FROM cuotas_plan_pago WHERE plan_id = $1 ORDER BY numero`,
      [plan.id],
    );
    plan.cuotas = cuotas.rows.map((row) => ({
      id: toId(row.id), planId: toId(row.planId), numero: Number(row.numero), anio: Number(row.anio), mes: Number(row.mes),
      fechaVencimiento: asDateString(row.fechaVencimiento), monto: Number(row.monto), estado: row.estado as "pendiente" | "pagado" | "anulado",
    }));
  }
  return plans;
}

export async function guardarHorariosManual(
  periodoId: string,
  input: GuardarHorarioManualInput,
): Promise<EstadoGestion> {
  await assertScheduleEditable(periodoId);
  const cpId = idValue(input.cursoPeriodoId, "cursoPeriodoId");
  const slots = input.slots ?? [];

  // 1. Validar formato y restricciones de bloques
  for (const slot of slots) {
    if (!slot.diaSemana || slot.diaSemana < 1 || slot.diaSemana > 5) {
      throw new HttpError(400, "diaSemana debe estar entre 1 y 5");
    }
    const hInicio = String(slot.horaInicio ?? "").slice(0, 5);
    const hFin = String(slot.horaFin ?? "").slice(0, 5);
    if (!hInicio || !hFin || hFin <= hInicio) {
      throw new HttpError(400, "Rango de horas inválido en bloque de horario");
    }
    // El recreo se valida contra el turno del curso dentro de la transacción.
  }

  // 2. Validar solapamientos internos dentro de los bloques enviados
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

      // 3. Resolver docentes y validar choque con otros cursos del periodo.
      //    El frontend envia usuario_id, pero se acepta también el id interno
      //    para mantener compatibilidad con clientes anteriores.
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

      // 4. Reemplazar el horario completo del curso. Las asignaciones
      // antiguas se cancelan para que no queden dos docentes activos para la
      // misma materia cuando el docente cambiado.
      await tx.queryObject(
        `UPDATE asignaciones_docentes
         SET estado = 'cancelado', fecha_finalizacion = NOW()
         WHERE curso_periodo_id = $1 AND estado = 'activo'`,
        [cpId],
      );
      await tx.queryObject(`DELETE FROM horarios WHERE curso_periodo_id = $1`, [cpId]);

      // 5. Insertar nuevos horarios
      for (const [slotIndex, slot] of slots.entries()) {
        const matId = idValue(slot.materiaId, "materiaId");
        let maestroDbId: string | null = null;
        let asigId: string | null = null;

        if (slot.maestroId) {
          const mIdRaw = String(slot.maestroId).trim();
          maestroDbId = await resolveTeacherId(mIdRaw);
          if (maestroDbId) {
            // Upsert asignacion docente: la combinación materia-curso se
            // asigna desde Construcción de horarios, no al crear la ficha.
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

export { buildShiftSlots, generateSchedule };
