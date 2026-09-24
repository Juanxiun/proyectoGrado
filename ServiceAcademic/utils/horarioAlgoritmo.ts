import { HttpError } from "./errors.ts";
import type { CodigoTurno } from "../models/academic.ts";

export interface HorarioSlot {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface ScheduleSession {
  materiaId: string;
  materiaNombre: string;
  asignacionId?: string | null;
  maestroId?: string | null;
  cargaHorariaSemanal: number;
  materiaPesada: boolean;
  pesoSintactico: number;
}

export interface ScheduleCourse {
  cursoPeriodoId: string;
  turno: CodigoTurno;
  capacidadMaxima?: number;
  sesiones: ScheduleSession[];
}

export interface ScheduleClassroom {
  id: string;
  capacidad?: number;
}

export interface GeneratedScheduleEntry {
  cursoPeriodoId: string;
  materiaId: string;
  asignacionId?: string | null;
  maestroId?: string | null;
  aulaId: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

interface ShiftDefinition {
  inicio: number;
  fin: number;
  recesoInicio: number;
  recesoFin: number;
}

const SHIFTS: Record<CodigoTurno, ShiftDefinition> = {
  manana: { inicio: 7 * 60, fin: 12 * 60 + 30, recesoInicio: 9 * 60 + 30, recesoFin: 10 * 60 },
  tarde: { inicio: 14 * 60, fin: 18 * 60 + 30, recesoInicio: 16 * 60, recesoFin: 16 * 60 + 30 },
};

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60).toString().padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Genera sólo bloques completos; los restos menores que la duración se omiten. */
export function buildShiftSlots(
  turno: CodigoTurno,
  duracionPeriodoMinutos: 45 | 50,
): HorarioSlot[] {
  if (duracionPeriodoMinutos !== 45 && duracionPeriodoMinutos !== 50) {
    throw new HttpError(400, "La duración debe ser 45 o 50 minutos");
  }
  const shift = SHIFTS[turno];
  if (!shift) throw new HttpError(400, `Turno inválido: ${turno}`);
  const intervals = [
    [shift.inicio, shift.recesoInicio],
    [shift.recesoFin, shift.fin],
  ];
  const slots: HorarioSlot[] = [];

  for (let day = 1; day <= 5; day++) {
    for (const [start, end] of intervals) {
      for (let cursor = start; cursor + duracionPeriodoMinutos <= end; cursor += duracionPeriodoMinutos) {
        slots.push({
          diaSemana: day,
          horaInicio: minutesToTime(cursor),
          horaFin: minutesToTime(cursor + duracionPeriodoMinutos),
        });
      }
    }
  }
  return slots;
}

function overlaps(a: HorarioSlot, b: HorarioSlot): boolean {
  return a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
}

/**
 * Genera una grilla voraz determinista. Primero intenta distribuir las
 * sesiones en el día con menor carga; luego prueba los bloques de ese día y
 * los demás como respaldo. No devuelve una grilla que violate una restricción
 * dura: si no encuentra espacio, falla para que la gestión no pueda activarse.
 */
export function generateSchedule(
  courses: ScheduleCourse[],
  classrooms: ScheduleClassroom[],
  duracionPeriodoMinutos: 45 | 50,
): GeneratedScheduleEntry[] {
  if (!classrooms.length) throw new HttpError(400, "Debe existir al menos un aula activa");
  if (!courses.length) throw new HttpError(400, "No hay cursos para generar horarios");

  const slotsByShift: Record<CodigoTurno, HorarioSlot[]> = {
    manana: buildShiftSlots("manana", duracionPeriodoMinutos),
    tarde: buildShiftSlots("tarde", duracionPeriodoMinutos),
  };
  const entries: GeneratedScheduleEntry[] = [];
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const courseBusy = new Set<string>();
  const dayLoad = new Map<string, number>();
  const heavyByCourseDay = new Map<string, number>();

  const orderedCourses = [...courses].sort((a, b) => a.cursoPeriodoId.localeCompare(b.cursoPeriodoId));
  for (const course of orderedCourses) {
    const slots = slotsByShift[course.turno];
    if (!slots) throw new HttpError(400, `Turno inválido: ${course.turno}`);
    if (!slots.length) throw new HttpError(400, `El turno ${course.turno} no tiene bloques completos`);
    const eligibleClassrooms = classrooms.filter((classroom) =>
      !course.capacidadMaxima || classroom.capacidad === undefined || classroom.capacidad >= course.capacidadMaxima
    );
    if (!eligibleClassrooms.length) {
      throw new HttpError(409, `No existe un aula con capacidad para el curso ${course.cursoPeriodoId}`);
    }

    for (const session of course.sesiones) {
      if (!Number.isInteger(session.cargaHorariaSemanal) || session.cargaHorariaSemanal < 1 || session.cargaHorariaSemanal > 40) {
        throw new HttpError(400, `Carga horaria inválida para ${session.materiaNombre}`);
      }
    }
    const expanded = course.sesiones
      .flatMap((session) => Array.from({ length: session.cargaHorariaSemanal }, () => ({ session })))
      .sort((a, b) => {
        if (a.session.materiaPesada !== b.session.materiaPesada) return a.session.materiaPesada ? -1 : 1;
        return b.session.pesoSintactico - a.session.pesoSintactico;
      });

    for (const item of expanded) {
      const candidates = [...slots].sort((a, b) => {
        const loadA = dayLoad.get(`${course.cursoPeriodoId}:${a.diaSemana}`) ?? 0;
        const loadB = dayLoad.get(`${course.cursoPeriodoId}:${b.diaSemana}`) ?? 0;
        if (loadA !== loadB) return loadA - loadB;
        return a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio);
      });

      let placed = false;
      for (const slot of candidates) {
        if (courseBusy.has(`${course.cursoPeriodoId}:${slot.diaSemana}:${slot.horaInicio}`)) continue;
        const heavyKey = `${course.cursoPeriodoId}:${slot.diaSemana}`;
        if (item.session.materiaPesada && (heavyByCourseDay.get(heavyKey) ?? 0) >= 2) continue;

        const aula = eligibleClassrooms.find((candidate) =>
          !roomBusy.has(`${candidate.id}:${slot.diaSemana}:${slot.horaInicio}`)
        );
        if (!aula) continue;
        if (item.session.maestroId && teacherBusy.has(`${item.session.maestroId}:${slot.diaSemana}:${slot.horaInicio}`)) continue;

        const teacherKey = item.session.maestroId
          ? `${item.session.maestroId}:${slot.diaSemana}:${slot.horaInicio}`
          : null;
        const roomKey = `${aula.id}:${slot.diaSemana}:${slot.horaInicio}`;
        const courseKey = `${course.cursoPeriodoId}:${slot.diaSemana}:${slot.horaInicio}`;

        entries.push({
          cursoPeriodoId: course.cursoPeriodoId,
          materiaId: item.session.materiaId,
          asignacionId: item.session.asignacionId ?? null,
          maestroId: item.session.maestroId ?? null,
          aulaId: aula.id,
          diaSemana: slot.diaSemana,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
        });
        if (teacherKey) teacherBusy.add(teacherKey);
        roomBusy.add(roomKey);
        courseBusy.add(courseKey);
        dayLoad.set(`${course.cursoPeriodoId}:${slot.diaSemana}`, (dayLoad.get(`${course.cursoPeriodoId}:${slot.diaSemana}`) ?? 0) + 1);
        if (item.session.materiaPesada) heavyByCourseDay.set(heavyKey, (heavyByCourseDay.get(heavyKey) ?? 0) + 1);
        placed = true;
        break;
      }

      if (!placed) {
        throw new HttpError(
          409,
          `No se pudo asignar ${item.session.materiaNombre} (${course.cursoPeriodoId}) sin conflictos`,
        );
      }
    }
  }

  // Verificación defensiva de traslapes y del límite de materias pesadas.
  for (let index = 0; index < entries.length; index++) {
    for (let other = index + 1; other < entries.length; other++) {
      const left = entries[index];
      const right = entries[other];
      const leftSlot = { diaSemana: left.diaSemana, horaInicio: left.horaInicio, horaFin: left.horaFin };
      const rightSlot = { diaSemana: right.diaSemana, horaInicio: right.horaInicio, horaFin: right.horaFin };
      if (!overlaps(leftSlot, rightSlot)) continue;
      if (left.cursoPeriodoId === right.cursoPeriodoId) {
        throw new HttpError(409, "Un paralelo tiene dos materias en el mismo bloque");
      }
      if (left.maestroId && left.maestroId === right.maestroId) {
        throw new HttpError(409, "Un docente tiene dos asignaciones en el mismo bloque");
      }
      if (left.aulaId === right.aulaId) {
        throw new HttpError(409, "Un aula tiene dos cursos en el mismo bloque");
      }
    }
  }

  return entries;
}
