import type { NivelRiesgo } from '../../../api/seguimiento.api';

export type Periodo = { id: string; nombre: string; anio: number; activo: boolean; estado: string };

export type Vista = 'cursos' | 'curso' | 'estudiante';

// resumen estudiante -> promedio, asistencia y riesgo
export interface ResumenEstudiante {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  promedio: number | null;
  asistencia: number | null;
  nivelRiesgo: NivelRiesgo;
}

export const TRIMESTRES = [1, 2, 3] as const;

export const ORDEN_RIESGO: NivelRiesgo[] = ['riesgo_alto', 'riesgo', 'observacion', 'sin_riesgo'];

// promediar -> media de los valores redondeada a dos decimales
export function promediar(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
}

export interface ItemEvaluacion {
  id: string;
  asignacionId: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  ponderacion: number;
  fechaPublicacion?: string;
  fechaLimite?: string;
  estado: string;
  materiaNombre?: string;
}

// extraerEvaluaciones -> filtrar encargos tipo prueba y mapearlos a items
export function extraerEvaluaciones(encargos: unknown, respaldoMateria: string): ItemEvaluacion[] {
  const lista = encargos as any[];
  return lista
    .filter((e) => ['examen', 'evaluacion', 'parcial'].includes(String(e.tipo).toLowerCase()))
    .map((e) => ({
      id: String(e.id),
      asignacionId: String(e.asignacionId || ''),
      tipo: e.tipo,
      titulo: e.titulo,
      descripcion: e.descripcion,
      ponderacion: Number(e.ponderacion) || 0,
      fechaPublicacion: e.fechaPublicacion,
      fechaLimite: e.fechaLimite,
      estado: e.estado || 'publicado',
      materiaNombre: e.asignacion?.materiaNombre || respaldoMateria,
    }));
}
