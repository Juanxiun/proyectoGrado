import { apiRequest, buildQuery } from './client';

/** Escala de riesgo del seguimiento académico. */
export type NivelRiesgo = 'sin_riesgo' | 'observacion' | 'riesgo' | 'riesgo_alto';

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  total: number;
  /** Porcentaje de asistencia efectiva; null si no hay registros. */
  tasa: number | null;
}

export interface EncargoLibro {
  id: string;
  titulo: string;
  tipo: string;
  ponderacion: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado: string;
  promedioCurso?: number | null;
}

export interface LineaLibro {
  estudianteId: string;
  usuarioId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  promedio: number | null;
  pesoAcumulado: number;
  pesoTotal: number;
  tareasCalificadas: number;
  tareasPublicadas: number;
  /** Porcentaje de la materia aún sin calificar. */
  desercion: number | null;
  asistencia: ResumenAsistencia;
  indice: number | null;
  nivelRiesgo: NivelRiesgo;
  observaciones: string[];
}

export interface LibroNotas {
  cursoPeriodoId: string;
  materia: { id: string; nombre: string; codigo: string; tipo: string };
  trimestre: { numero: number; inicio: string; fin: string } | null;
  periodo: { id: string; nombre: string; anio: number };
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  docente?: { maestroId: string; usuarioId: string; nombre: string } | null;
  encargos: EncargoLibro[];
  lineas: LineaLibro[];
  resumen: {
    estudiantes: number;
    promedioCurso: number | null;
    promedioMasAlto: number | null;
    promedioMasBajo: number | null;
    enRiesgo: number;
    enRiesgoAlto: number;
  };
}

export interface DesempenoMateriaResumen {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  promedio: number | null;
  promedioAsistencia: number | null;
  estudiantesEvaluados: number;
  enRiesgo: number;
}

export interface RangoPromedio {
  rango: string;
  minimo: number;
  maximo: number;
  estudiantes: number;
}

export interface PanelCurso {
  cursoPeriodoId: string;
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  periodo: { id: string; nombre: string; anio: number };
  estudiantes: number;
  totalMaterias: number;
  promedioGeneral: number | null;
  promedioAsistencia: number | null;
  distribucionPromedios: RangoPromedio[];
  materias: DesempenoMateriaResumen[];
  riesgo: { total: number; observacion: number; alto: number };
}

export interface DesempenoMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  promedio: number | null;
  indice: number | null;
  asistencia: ResumenAsistencia;
  tareasCalificadas: number;
  tareasPublicadas: number;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
}

export interface PanelEstudiante {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  cursoParalelo: string;
  indiceGeneral: number | null;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
  periodos: Array<{
    periodoId: string;
    nombre: string;
    anio: number;
    promedio: number | null;
    indice: number | null;
    asistencia: ResumenAsistencia;
    indiceDesempeno: number;
    nivelRiesgo: NivelRiesgo;
    materias: DesempenoMateria[];
  }>;
}

export interface AlertaRiesgo {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  cursoParalelo: string;
  materia: string;
  promedio: number | null;
  asistencia: number | null;
  nivelRiesgo: NivelRiesgo;
  motivos: string[];
}

export interface UmbralesSeguimiento {
  notaMaxima: number;
  umbralNotaRiesgo: number;
  umbralAsistenciaRiesgo: number;
  umbralNotaRiesgoAlto: number;
  umbralAsistenciaRiesgoAlto: number;
  umbralObservacion: number;
  pesoAsistencia: number;
  pesoPromedio: number;
}

/**
 * Seguimiento académico. Las notas se calculan en el backend a partir de las
 * calificaciones y su ponderación, así que no hay nada que promediar aquí:
 * esta capa sólo muestra lo que devuelve ServiceAcademic.
 */
export const seguimientoApi = {
  async libro(params: {
    cursoPeriodoId: string | number;
    materiaId: string | number;
    trimestre: number;
  }): Promise<LibroNotas | null> {
    try {
      return await apiRequest<LibroNotas>(
        `/api/seguimiento/libro${buildQuery({
          cursoPeriodoId: String(params.cursoPeriodoId),
          materiaId: String(params.materiaId),
          trimestre: String(params.trimestre),
        })}`,
      );
    } catch (err) {
      console.warn('[seguimientoApi.libro]', err);
      return null;
    }
  },

  async panelCurso(params: {
    cursoPeriodoId: string | number;
    trimestre: number;
  }): Promise<PanelCurso | null> {
    try {
      return await apiRequest<PanelCurso>(
        `/api/seguimiento/panel/curso${buildQuery({
          cursoPeriodoId: String(params.cursoPeriodoId),
          trimestre: String(params.trimestre),
        })}`,
      );
    } catch (err) {
      console.warn('[seguimientoApi.panelCurso]', err);
      return null;
    }
  },

  async panelEstudiante(params: {
    estudianteId: string | number;
    periodoId: string | number;
    trimestre: number;
  }): Promise<PanelEstudiante | null> {
    try {
      return await apiRequest<PanelEstudiante>(
        `/api/seguimiento/panel/estudiante/${params.estudianteId}${buildQuery({
          periodoId: String(params.periodoId),
          trimestre: String(params.trimestre),
        })}`,
      );
    } catch (err) {
      console.warn('[seguimientoApi.panelEstudiante]', err);
      return null;
    }
  },

  async riesgo(params: {
    periodoId: string | number;
    trimestre: number;
    limite?: number;
  }): Promise<{ total: number; umbrales: UmbralesSeguimiento; alertas: AlertaRiesgo[] } | null> {
    try {
      return await apiRequest(
        `/api/seguimiento/riesgo${buildQuery({
          periodoId: String(params.periodoId),
          trimestre: String(params.trimestre),
          limite: params.limite,
        })}`,
      );
    } catch (err) {
      console.warn('[seguimientoApi.riesgo]', err);
      return null;
    }
  },

  async umbrales(): Promise<UmbralesSeguimiento | null> {
    try {
      return await apiRequest<UmbralesSeguimiento>('/api/seguimiento/umbrales');
    } catch (err) {
      console.warn('[seguimientoApi.umbrales]', err);
      return null;
    }
  },
};

/** Etiqueta y color del nivel de riesgo, para reutilizar en toda la interfaz. */
export const RIESGO_META: Record<NivelRiesgo, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  sin_riesgo: { label: 'En regla', variant: 'success' },
  observacion: { label: 'En observación', variant: 'info' },
  riesgo: { label: 'En riesgo', variant: 'warning' },
  riesgo_alto: { label: 'Riesgo alto', variant: 'danger' },
};
