import { API_BASE_URL } from '../constants/config';
import { storage } from '../utils/storage';
import { apiRequest, buildQuery } from './client';

export type NivelDificultad = 'Alto' | 'Medio' | 'Moderado';

export interface TrimestreVigente {
  id: string;
  numero: number;
  inicio: string;
  fin: string;
  periodoNombre: string;
}

export interface TemaRagOption {
  materialId: string;
  titulo: string;
  temaNombre: string;
  temaId?: string | null;
  temaUnidad?: number | null;
  tipoMaterial?: 'estudio' | 'actividad' | null;
  nombreArchivo?: string | null;
  detalle?: string;
  ragDisponible: boolean;
  resumen: string;
  conceptosClave: string[];
}

export interface ModuloAvanceOption {
  id: string;
  unidad: number;
  titulo: string;
  contenidos: string;
  horasPrevistas: number;
  esEvaluacion: boolean;
  materiales: TemaRagOption[];
}

export interface SugerenciaDificultad {
  nivel: NivelDificultad;
  promedioCurso: number | null;
  asistenciaPromedio: number | null;
  justificacion: string;
}

export interface ContextoTrimestral {
  trimestreVigente: TrimestreVigente | null;
  trimestresDisponibles?: TrimestreVigente[];
  asignacion: {
    id: string;
    materiaNombre: string;
    cursoNombre: string;
    nivel: string;
  };
  temas: TemaRagOption[];
  modulos?: ModuloAvanceOption[];
  materialesSinModulo?: TemaRagOption[];
  sugerenciaDificultad: SugerenciaDificultad;
}

export interface ParTrimestral {
  izquierda: string;
  derecha: string;
}

export interface PreguntaTrimestral {
  id: string;
  numero: number;
  categoria: 'TEORICA' | 'PRACTICA';
  formato:
    | 'SELECCION_MULTIPLE'
    | 'COMPLETAR'
    | 'CONECTAR_FRASES'
    | 'DRAG_AND_DROP'
    | 'RESOLVER_EJERCICIO';
  tema: string;
  enunciado_md: string;
  opciones?: string[];
  pares?: ParTrimestral[];
  items?: string[];
  respuesta_correcta_md?: string;
  criterio_evaluacion_md?: string;
  puntaje: number;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  comentario?: string;
}

export interface EvaluacionTrimestral {
  id: string;
  jobId?: string;
  asignacionId: string;
  trimestreId: string;
  trimestreNumero?: number;
  docenteUsuarioId: string;
  titulo: string;
  materiaNombre: string;
  cursoNombre: string;
  dificultadSugerida: string;
  dificultadFinal: NivelDificultad;
  cantidadPreguntas: 10 | 15 | 20;
  cantidadTeoricas: number;
  cantidadPracticas: number;
  temas: Array<{ materialId: string; titulo: string; temaNombre?: string }>;
  preguntas: PreguntaTrimestral[];
  estado: 'generando' | 'en_revision' | 'aprobada' | 'error';
  errorMensaje?: string | null;
  progreso?: number;
  estadoDetalle?: string | null;
  loteActual?: number;
  totalLotes?: number;
  preguntasGeneradas?: number;
  ragKey?: string | null;
  tienePdf: boolean;
  versionPdf: number;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface GenerarTrimestralPayload {
  asignacionId: string;
  trimestreId?: string;
  trimestreNumero?: 1 | 2 | 3;
  titulo?: string;
  dificultadSugerida: NivelDificultad;
  dificultadFinal: NivelDificultad;
  cantidadPreguntas: 10 | 15 | 20;
  cantidadTeoricas: number;
  cantidadPracticas: number;
  temas: Array<{ materialId: string; titulo: string; temaNombre?: string }>;
}

export const evaluacionTrimestralApi = {
  getContexto: (asignacionId: string) =>
    apiRequest<ContextoTrimestral>(
      `/api/evaluaciones-trimestrales/contexto${buildQuery({ asignacionId })}`,
      { noCache: true, cache: 'no-store' },
    ),

  list: (asignacionId?: string) =>
    apiRequest<{ data: EvaluacionTrimestral[] }>(
      `/api/evaluaciones-trimestrales${buildQuery({ asignacionId })}`,
      { noCache: true, cache: 'no-store' },
    ),

  getById: (id: string) =>
    apiRequest<EvaluacionTrimestral>(`/api/evaluaciones-trimestrales/${id}`, {
      noCache: true,
      cache: 'no-store',
    }),

  generar: (payload: GenerarTrimestralPayload) =>
    apiRequest<EvaluacionTrimestral>('/api/evaluaciones-trimestrales/generar', {
      method: 'POST',
      body: payload,
    }),

  actualizarEstadoPregunta: (
    id: string,
    preguntaId: string,
    estado: 'aprobada' | 'rechazada' | 'pendiente',
    comentario?: string,
  ) =>
    apiRequest<EvaluacionTrimestral>(
      `/api/evaluaciones-trimestrales/${id}/preguntas/${encodeURIComponent(preguntaId)}/estado`,
      {
        method: 'PATCH',
        body: { estado, comentario },
      },
    ),

  regenerarPregunta: (id: string, preguntaId: string, indicaciones: string) =>
    apiRequest<{ pregunta: PreguntaTrimestral; evaluacion: EvaluacionTrimestral }>(
      `/api/evaluaciones-trimestrales/${id}/preguntas/${encodeURIComponent(preguntaId)}/regenerar`,
      {
        method: 'POST',
        body: { indicaciones },
      },
    ),

  aprobar: (id: string) =>
    apiRequest<EvaluacionTrimestral>(
      `/api/evaluaciones-trimestrales/${id}/aprobar`,
      {
        method: 'POST',
        body: {},
      },
    ),

  remove: (id: string) =>
    apiRequest<{ ok: boolean }>(`/api/evaluaciones-trimestrales/${id}`, {
      method: 'DELETE',
    }),

  fetchPdfBlob: async (id: string, download = false): Promise<{ blob: Blob; blobUrl: string; fileName: string }> => {
    const token = await storage.getToken();
    const res = await fetch(
      `${API_BASE_URL}/api/evaluaciones-trimestrales/${id}/pdf${download ? '?download=1' : ''}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) {
      throw new Error(
        res.status === 403
          ? 'No tienes permisos para ver esta evaluación trimestral.'
          : 'No se pudo cargar el documento PDF.',
      );
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] || `evaluacion_trimestral_${id}.pdf`;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { blob, blobUrl, fileName };
  },
};
