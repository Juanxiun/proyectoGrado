import type { Transaction } from "@db/postgres";
import { query } from "../../connects/Database/transaction.ts";
import type {
  Aula,
  CodigoTurno,
  CreatePeriodoInput,
  EstadoPeriodo,
  Horario,
  NivelEducativo,
  PeriodoAcademico,
  PlanPago,
  TrimestreInput,
} from "../../models/academic.ts";
import { HttpError } from "../../utils/errors.ts";
import { asDateString, serialize, toId } from "../../utils/serialize.ts";
import {
  validateGestionRange,
  validateIsoDate,
  validateTrimestres,
} from "../../utils/gestionValidation.ts";

// shared -> tipos de fila, normalizadores, mappers y validaciones reutilizadas por los módulos de gestión
export interface PeriodoRow {
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

export interface TurnoRow {
  id: bigint;
  codigo: CodigoTurno;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  recesoInicio: string;
  recesoFin: string;
  duracionPeriodoMinutos: number;
}

export interface AulaRow {
  id: bigint;
  codigo: string;
  nombre: string;
  capacidad: number;
  activa: boolean;
}

export interface CursoPeriodoRow {
  id: bigint;
  cursoId: bigint;
  periodoId: bigint;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  turnoId: bigint | null;
  capacidadMaxima: number;
}

export interface MallaRow {
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

export interface AsignacionRow {
  id: bigint;
  cursoPeriodoId: bigint;
  materiaId: bigint;
  maestroId: bigint;
  materiasConfiguradas: boolean;
  materiaPermitida: boolean;
  estado: string;
}

export interface HorarioRow {
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
  cursoNivel?: string;
  cursoGrado?: string;
  cursoParalelo?: string;
  turnoCodigo?: "manana" | "tarde";
  turnoNombre?: string;
  maestroNombre?: string;
  maestroApellido?: string;
  maestroUsuarioId?: bigint;
}

export interface PlanRow {
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

export const DEFAULT_GRADES = ["1°", "2°", "3°", "4°", "5°", "6°"];
export const DEFAULT_LEVELS: Array<{ nivel: NivelEducativo; grados: string[]; paralelos: Record<string, number> }> = [
  { nivel: "primaria", grados: DEFAULT_GRADES, paralelos: {} },
  { nivel: "secundaria", grados: DEFAULT_GRADES, paralelos: {} },
];

export function normalizeEstado(value: unknown): EstadoPeriodo {
  const estado = String(value ?? "configuracion").toLowerCase();
  if (["borrador", "configuracion", "activo", "cerrado", "cancelado"].includes(estado)) {
    return estado as EstadoPeriodo;
  }
  return "configuracion";
}

export function asTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  return String(value ?? "").slice(0, 5);
}

export function mapPeriodo(row: PeriodoRow): PeriodoAcademico {
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

export function mapAula(row: AulaRow): Aula {
  return serialize({
    id: toId(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    capacidad: Number(row.capacidad),
    activa: Boolean(row.activa),
  });
}

export function mapHorario(row: HorarioRow): Horario {
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
    curso: row.cursoNivel && row.cursoGrado && row.cursoParalelo
      ? { nivel: row.cursoNivel, grado: row.cursoGrado, paralelo: row.cursoParalelo }
      : undefined,
    turno: row.turnoCodigo && row.turnoNombre
      ? { codigo: row.turnoCodigo, nombre: row.turnoNombre }
      : undefined,
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

export function mapPlan(row: PlanRow): PlanPago {
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

export function idValue(value: unknown, field: string): string {
  const id = String(value ?? "").trim();
  if (!/^\d+$/.test(id)) throw new HttpError(400, `${field} debe ser numérico`);
  return id;
}

export function validateYearAndName(anio: unknown, nombre: unknown): void {
  const year = Number(anio);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, "anio debe ser un entero entre 2000 y 2100");
  }
  if (!String(nombre ?? "").trim()) throw new HttpError(400, "nombre es obligatorio");
}

export function normalizePeriodDates(input: CreatePeriodoInput): {
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

export async function ensureTurnos(tx: Transaction): Promise<Map<CodigoTurno, TurnoRow>> {
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

export async function ensureAulas(tx: Transaction, requestedIds?: string[]): Promise<AulaRow[]> {
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

export async function getPeriodoRow(id: string): Promise<PeriodoRow> {
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

export async function assertEditable(id: string): Promise<PeriodoRow> {
  const row = await getPeriodoRow(id);
  const estado = normalizeEstado(row.estado);
  if (estado === "activo" || estado === "cerrado" || estado === "cancelado") {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no puede modificarse`);
  }
  return row;
}

export async function assertEditableTx(tx: Transaction, id: string): Promise<void> {
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

export async function assertScheduleEditable(id: string): Promise<PeriodoRow> {
  const row = await getPeriodoRow(id);
  const estado = normalizeEstado(row.estado);
  if (estado === "cerrado" || estado === "cancelado") {
    throw new HttpError(409, `La gestión ${id} está ${estado} y no permite modificar horarios`);
  }
  return row;
}

export async function assertScheduleEditableTx(tx: Transaction, id: string): Promise<void> {
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

export async function insertTrimestres(tx: Transaction, periodoId: string, trimestres: TrimestreInput[]): Promise<void> {
  for (const trimestre of trimestres) {
    await tx.queryObject(
      `INSERT INTO trimestres (periodo_id, numero, inicio, fin)
       VALUES ($1, $2, $3, $4)`,
      [periodoId, trimestre.numero, trimestre.inicio, trimestre.fin],
    );
  }
}
