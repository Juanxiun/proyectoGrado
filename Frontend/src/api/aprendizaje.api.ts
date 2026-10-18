import { apiRequest } from './client';

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function solicitarConReintento<T>(solicitud: () => Promise<T>, intentos = 2, reintentarNoEncontrado = false): Promise<T> {
  let errorFinal: unknown;
  for (let intento = 0; intento <= intentos; intento += 1) {
    try {
      return await solicitud();
    } catch (error) {
      errorFinal = error;
      if (error instanceof Error && 'status' in error) {
        const status = Number((error as Error & { status: number }).status);
        if (status === 404 && reintentarNoEncontrado && intento < intentos) {
          await esperar(500 * (intento + 1));
          continue;
        }
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) throw error;
      }
      if (intento < intentos) await esperar(500 * (intento + 1));
    }
  }
  throw errorFinal;
}

export type FormatoResumen = 'CARTAS_EXPLICATIVAS' | 'CONEXIONES' | 'ESQUEMA_GEMMA';

export interface ContenidoAprendizaje {
  content_id: string;
  title: string;
  summary: string;
  subject?: string;
  topic_id?: string;
  learning_objectives: string[];
  key_concepts: string[];
  microlearning_units: Array<{ title: string; explanation: string; objective: string; inquiry_question: string }>;
  inquiry_questions: string[];
  difficulty: string;
}

export interface ResumenAprendizaje {
  content_id: string;
  formato: FormatoResumen;
  data: Record<string, unknown>;
  recommendation?: string;
}

export interface ExplicacionSeccion {
  title: string;
  explanation: string;
  examples: string[];
  microlearning_units: Array<{ title: string; explanation: string; objective: string; inquiry_question: string }>;
  inquiry_questions: string[];
  format: 'analogía' | 'paso_a_paso' | 'ejemplo' | 'preguntas';
  profile_available: boolean;
}

export interface ActividadAprendizaje {
  activity_id: string;
  tipo: 'SELECCION_MULTIPLE' | 'CUESTIONARIO' | 'FLASHCARD' | 'VERDADERO_FALSO' | 'CONECTAR_FRASES' | 'DRAG_AND_DROP';
  question?: string;
  options?: string[];
  front?: string;
  back?: string;
  statement?: string;
  pairs?: Array<{ left: string; right: string }>;
  left_items?: string[];
  right_items?: string[];
  items?: string[];
  difficulty?: string;
  learning_objective?: string;
}

export interface RetoAprendizaje {
  quiz_id: string;
  content_id: string;
  activity_count: number;
  activities: ActividadAprendizaje[];
}

export interface FeedbackActividad {
  concept: string;
  where_failed?: string;
  correct_answer?: string;
  explanation?: string;
}

export interface ResultadoReto {
  score: number;
  correct: number;
  total: number;
  answers: Array<{
    activity_id: string;
    tipo: string;
    correct: boolean;
    concept: string;
    difficulty: string;
    feedback?: FeedbackActividad;
  }>;
}

export interface ResultadoEmparejamiento {
  correct: boolean;
  expected?: string;
  feedback: FeedbackActividad;
}

export const aprendizajeApi = {
  contenido: (materialId: string) => solicitarConReintento(() => apiRequest<ContenidoAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}`, { signal: AbortSignal.timeout(30000) }), 3, true),
  resumen: (materialId: string, formato: FormatoResumen) => solicitarConReintento(() => apiRequest<ResumenAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/resumen`, { method: 'POST', body: { formato }, signal: AbortSignal.timeout(300000) }), 0),
  explicarSeccion: (materialId: string, section: { title: string; explanation: string; example?: string; format: ExplicacionSeccion['format'] }) => solicitarConReintento(() => apiRequest<ExplicacionSeccion>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/explicar-seccion`, { method: 'POST', body: section, signal: AbortSignal.timeout(300000) }), 0),
  reto: (materialId: string, cantidad = 6) => apiRequest<RetoAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto?cantidad=${cantidad}`, { method: 'POST', signal: AbortSignal.timeout(600000) }),
  validarEmparejamiento: (materialId: string, quizId: string, activityId: string, left: string, right: string) => apiRequest<ResultadoEmparejamiento>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/comprobar-pareja`, { method: 'POST', body: { activity_id: activityId, left, right }, signal: AbortSignal.timeout(30000) }),
  completarReto: (materialId: string, quizId: string, answers: Array<{ activity_id: string; response: string }>, elapsedMs = 0) => apiRequest<ResultadoReto>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/completar`, { method: 'POST', body: { answers, elapsed_ms: elapsedMs } }),
};
