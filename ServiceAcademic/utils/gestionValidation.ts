import { HttpError } from "./errors.ts";
import { isIsoDate } from "./http.ts";
import type { TrimestreInput } from "../models/academic.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: unknown, field: string): Date {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new HttpError(400, `${field} debe tener formato YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${field} no es una fecha válida`);
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Valida el rango principal de una gestión. La fecha final debe ser
 * estrictamente posterior a la inicial, no sólo igual o anterior.
 */
export function validateGestionRange(inicio: unknown, fin: unknown): void {
  const inicioDate = parseIsoDate(inicio, "inicio_gestion");
  const finDate = parseIsoDate(fin, "fin_gestion");
  if (finDate <= inicioDate) {
    throw new HttpError(400, "fin_gestion debe ser estrictamente posterior a inicio_gestion");
  }
}

function isInstructionalDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Los trimestres deben ser consecutivos en días lectivos. Se permite que el
 * intervalo entre dos trimestres contenga sólo sábado/domingo; cualquier día
 * hábil intermedio se considera una brecha no cubierta.
 */
export function validateTrimestres(
  inicioGestion: unknown,
  finGestion: unknown,
  trimestres: unknown,
): asserts trimestres is TrimestreInput[] {
  if (!Array.isArray(trimestres) || trimestres.length !== 3) {
    throw new HttpError(400, "Deben enviarse exactamente los tres trimestres");
  }

  const inicio = parseIsoDate(inicioGestion, "inicio_gestion");
  const fin = parseIsoDate(finGestion, "fin_gestion");
  const ordenados = [...trimestres].sort((a, b) => Number(a.numero) - Number(b.numero));

  ordenados.forEach((trimestre, index) => {
    if (!trimestre || trimestre.numero !== index + 1) {
      throw new HttpError(400, "Los trimestres deben estar numerados 1, 2 y 3");
    }
    const trimestreInicio = parseIsoDate(trimestre.inicio, `inicio_${trimestre.numero}T`);
    const trimestreFin = parseIsoDate(trimestre.fin, `fin_${trimestre.numero}T`);
    if (trimestreFin < trimestreInicio) {
      throw new HttpError(400, `fin_${trimestre.numero}T no puede ser anterior a inicio_${trimestre.numero}T`);
    }
    if (trimestreInicio < inicio) {
      throw new HttpError(400, `inicio_${trimestre.numero}T debe ser igual o posterior a inicio_gestion`);
    }
    if (trimestreFin > fin) {
      throw new HttpError(400, `fin_${trimestre.numero}T debe ser anterior o igual a fin_gestion`);
    }
  });

  const primerInicio = parseIsoDate(ordenados[0].inicio, "inicio_1T");
  for (let cursor = addDays(inicio, 0); cursor < primerInicio; cursor = addDays(cursor, 1)) {
    if (isInstructionalDay(cursor)) {
      throw new HttpError(400, "Existe un día lectivo sin cubrir antes del primer trimestre");
    }
  }
  const ultimoFin = parseIsoDate(ordenados[ordenados.length - 1].fin, "fin_3T");
  for (let cursor = addDays(ultimoFin, 1); cursor <= fin; cursor = addDays(cursor, 1)) {
    if (isInstructionalDay(cursor)) {
      throw new HttpError(400, "Existe un día lectivo sin cubrir después del último trimestre");
    }
  }

  for (let index = 1; index < ordenados.length; index++) {
    const anterior = ordenados[index - 1];
    const siguiente = ordenados[index];
    const finAnterior = parseIsoDate(anterior.fin, `fin_${anterior.numero}T`);
    const inicioSiguiente = parseIsoDate(siguiente.inicio, `inicio_${siguiente.numero}T`);

    if (finAnterior >= inicioSiguiente) {
      throw new HttpError(400, `Los trimestres ${anterior.numero} y ${siguiente.numero} se solapan`);
    }

    for (let cursor = addDays(finAnterior, 1); cursor < inicioSiguiente; cursor = addDays(cursor, 1)) {
      if (isInstructionalDay(cursor)) {
        throw new HttpError(
          400,
          `Existe un día lectivo sin cubrir entre el trimestre ${anterior.numero} y el ${siguiente.numero}`,
        );
      }
    }
  }
}

export function validateIsoDate(value: unknown, field: string): void {
  if (!isIsoDate(value)) throw new HttpError(400, `${field} debe tener formato YYYY-MM-DD`);
  parseIsoDate(value, field);
}

export function countManagementMonths(inicio: string, fin: string): number {
  validateGestionRange(inicio, fin);
  const start = parseIsoDate(inicio, "inicio_gestion");
  const end = parseIsoDate(fin, "fin_gestion");
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) + 1;
}

export interface Installment {
  numero: number;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  monto: number;
}

export function distributeInstallmentAmounts(installments: Installment[], montoTotal: number): void {
  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    throw new HttpError(400, "montoTotal debe ser mayor a 0");
  }
  if (!installments.length) return;
  const cents = Math.round(montoTotal * 100);
  if (cents < installments.length) {
    throw new HttpError(400, "El monto total no alcanza para crear todas las cuotas");
  }
  const base = Math.floor(cents / installments.length);
  const remainder = cents % installments.length;
  installments.forEach((installment, index) => {
    installment.monto = (base + (index < remainder ? 1 : 0)) / 100;
  });
}

export function buildInstallments(
  inicio: string,
  fin: string,
  montoCuota: number,
  diaVencimiento = 10,
): Installment[] {
  validateGestionRange(inicio, fin);
  if (!Number.isFinite(montoCuota) || montoCuota <= 0) {
    throw new HttpError(400, "montoCuota debe ser mayor a 0");
  }
  if (!Number.isInteger(diaVencimiento) || diaVencimiento < 1 || diaVencimiento > 28) {
    throw new HttpError(400, "diaVencimiento debe estar entre 1 y 28");
  }

  const start = parseIsoDate(inicio, "inicio_gestion");
  const end = parseIsoDate(fin, "fin_gestion");
  const months = countManagementMonths(inicio, fin);
  const rounded = Math.round(montoCuota * 100) / 100;
  const installments: Installment[] = [];

  for (let index = 0; index < months; index++) {
    const monthDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, diaVencimiento));
    let due = monthDate;
    if (index === 0 && due < start) due = start;
    if (index === months - 1 && due > end) due = end;
    installments.push({
      numero: index + 1,
      anio: due.getUTCFullYear(),
      mes: due.getUTCMonth() + 1,
      fechaVencimiento: formatIsoDate(due),
      monto: rounded,
    });
  }
  return installments;
}
