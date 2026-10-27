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

export type FormatoResumen = 'CARTAS_EXPLICATIVAS' | 'ESQUEMA_GEMMA';

export interface ContenidoAprendizaje {
  content_id: string;
  title: string;
  summary: string;
  subject?: string;
  topic_id?: string;
  learning_objectives: string[];
  key_concepts: string[];
  microlearning_units: Array<{ title: string; explanation: string; objective: string; inquiry_question: string; svg_inline?: string }>;
  inquiry_questions: string[];
  difficulty: string;
  learning_sections?: Array<{
    numero: number;
    titulo: string;
    texto_plano: string;
    resumen: string;
    conceptos: string[];
    microlearning: Array<{ title: string; explanation: string; objective: string; inquiry_question: string; examples_blackboard?: string[]; svg_inline?: string }>;
    checkpoint: string;
    svg_inline: string;
    preguntas_indagacion?: string[];
    carta_6_esquema?: {
      titulo?: string;
      nodes?: Array<{ id?: string; label?: string; detail?: string; mini_example?: string }>;
      edges?: Array<{ source?: string; target?: string; label?: string }>;
      svg_inline?: string;
    };
    conexiones?: Array<{ tema: string; relacion: string; conceptos: string[] }>;
  }>;
}

export interface VistaPreviaPdf {
  paginas: number;
  ancho: number;
  alto: number;
}

export interface PaginaPdf {
  pagina: number;
  total: number;
  ancho: number;
  alto: number;
  imagen: string;
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
  explanation_svg?: string;
  examples: string[];
  microlearning_units: Array<{ title: string; explanation: string; objective: string; inquiry_question: string }>;
  inquiry_questions: string[];
  format: 'analogía' | 'paso_a_paso' | 'ejemplo' | 'preguntas';
  profile_available: boolean;
}

export interface ActividadAprendizaje {
  activity_id: string;
  tipo: 'SELECCION_MULTIPLE' | 'COMPLETAR' | 'CONECTAR_FRASES' | 'DRAG_AND_DROP';
  activity_mode?: 'concepto' | 'practica';
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
  exercise_svg?: string;
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
  learning_feedback?: { feedback: string; next_step: string; points: number; explanation_svg?: string; model?: string; pending?: boolean };
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

export interface PerfilAprendizajeEstudiante {
  learning_rhythm: string;
  strengths: string[];
  learning_orientation: 'teorico' | 'practico' | 'equilibrado' | 'evidencia_insuficiente';
  preferred_formats: Array<'graficos_esquemas' | 'cartas' | 'resumenes_directos' | 'ejercicios_practicos'>;
  investigated_topics_count: number;
  deep_inquiry_topics: string[];
  possible_ambitions: string[];
  personalization_recommendation: string;
  confidence: 'baja' | 'media' | 'alta';
  evidence_activity_count: number;
  completed_summaries: number;
  updated_at: string;
  model: string;
}

export interface RetroalimentacionReto {
  feedback: string;
  next_step: string;
  points: number;
  model?: string;
  pending?: boolean;
}

export const aprendizajeApi = {
  contenido: (materialId: string) => solicitarConReintento(() => apiRequest<ContenidoAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}`, { signal: AbortSignal.timeout(30000) }), 3, true),
  resumen: (materialId: string, formato: FormatoResumen) => solicitarConReintento(() => apiRequest<ResumenAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/resumen`, { method: 'POST', body: { formato }, signal: AbortSignal.timeout(300000) }), 0),
  explicarSeccion: (materialId: string, section: { title: string; explanation: string; example?: string; format: ExplicacionSeccion['format'] }) => solicitarConReintento(() => apiRequest<ExplicacionSeccion>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/explicar-seccion`, { method: 'POST', body: section, signal: AbortSignal.timeout(300000) }), 0),
  reto: (materialId: string, cantidad = 5, sectionId?: string) => apiRequest<RetoAprendizaje>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto?cantidad=${cantidad}${sectionId ? `&seccion=${encodeURIComponent(sectionId)}` : ''}`, { method: 'POST', signal: AbortSignal.timeout(30000) }),
  validarEmparejamiento: (materialId: string, quizId: string, activityId: string, left: string, right: string) => apiRequest<ResultadoEmparejamiento>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/comprobar-pareja`, { method: 'POST', body: { activity_id: activityId, left, right }, signal: AbortSignal.timeout(30000) }),
  comprobarActividad: (materialId: string, quizId: string, activityId: string, response: string) => apiRequest<{ correct: boolean }>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/comprobar`, { method: 'POST', body: { activity_id: activityId, response }, signal: AbortSignal.timeout(15000) }),
  vistaPreviaPdf: (materialId: string) => apiRequest<VistaPreviaPdf>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/vista-previa`, { signal: AbortSignal.timeout(90000) }),
  paginaPdf: (materialId: string, numero: number) => apiRequest<PaginaPdf>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/pagina/${numero}`, { signal: AbortSignal.timeout(120000) }),
  completarReto: (materialId: string, quizId: string, answers: Array<{ activity_id: string; response: string }>, elapsedMs = 0) => apiRequest<ResultadoReto>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/completar`, { method: 'POST', body: { answers, elapsed_ms: elapsedMs }, signal: AbortSignal.timeout(90000) }),
  retroalimentacionReto: (materialId: string, quizId: string) => apiRequest<RetroalimentacionReto>(`/api/aprendizaje/materiales/${encodeURIComponent(materialId)}/reto/${encodeURIComponent(quizId)}/feedback`, { method: 'GET', signal: AbortSignal.timeout(15000) }),
  evaluarPerfilAprendizaje: (evidence: unknown) => apiRequest<PerfilAprendizajeEstudiante>('/api/aprendizaje/perfil-aprendizaje', { method: 'POST', body: { evidence }, signal: AbortSignal.timeout(90000) }),
};
