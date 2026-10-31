import { apiRequest, buildQuery } from './client';

export interface RachasDiarias {
  id: string;
  usuarioId: string;
  fecha: string;
  completada: boolean;
  aciertos: number;
  totalPreguntas: number;
  porcentajeAcierto: number;
  rachaActual: number;
  mejorRacha: number;
  salvadaConPuntos: boolean;
  puntosGastados: number;
  creadaEn: string;
  actualizadaEn: string;
}

export interface PuntosIndividuales {
  id: string;
  usuarioId: string;
  cursoPeriodoId?: string;
  paralelo?: 'A' | 'B';
  fecha: string;
  tipo: 'respuesta_correcta' | 'leer_resumen' | 'salvar_racha' | 'pista_examen' | 'ajuste_manual' | 'canje_tienda';
  puntos: number;
  descripcion: string;
  metadata?: Record<string, unknown>;
  creadaEn: string;
}

export interface Insignia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  iconoUrl?: string;
  criterio: string;
  activa: boolean;
}

export interface InsigniaEstudiante {
  id: string;
  usuarioId: string;
  insigniaId: string;
  fechaObtencion: string;
  metadata?: Record<string, unknown>;
  codigo?: string;
  nombre?: string;
}

export interface Trofeo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  iconoUrl?: string;
  puntos: number;
  criterio: string;
  periodo: 'semanal' | 'trimestral' | 'anual';
  activo: boolean;
}

export interface TrofeoEstudiante {
  id: string;
  usuarioId: string;
  trofeoId: string;
  fechaObtencion: string;
  puntosOtorgados: number;
  metadata?: Record<string, unknown>;
  trofeoNombre?: string;
  trofeoCodigo?: string;
  trofeoDescripcion?: string;
}

export interface RecompensaTienda {
  id: string;
  nombre: string;
  descripcion: string;
  costoPuntosIndividuales: number;
  tipo: 'pista_examen' | 'salvar_racha' | 'cosmetico' | 'otro';
  iconoUrl?: string;
  stock: number | null;
  activa: boolean;
}

export interface CompraEstudiante {
  id: string;
  usuarioId: string;
  cursoPeriodoId?: string;
  paralelo?: 'A' | 'B';
  recompensaId: string;
  puntosGastados: number;
  fechaCompra: string;
  usada: boolean;
  fechaUso?: string;
}

export interface RankingEstudiante {
  usuarioId: string;
  estudianteId: string;
  tag: string;
  nombre: string;
  apellidoPaterno: string;
  avatarUrl?: string | null;
  rachaActual: number;
  mejorRacha: number;
  promedioRendimiento: number;
  calidadPromedio: number;
  tiempoPromedioMs: number;
  puntosIndividuales: number;
  nivel: number;
  rango: 'D' | 'C' | 'B' | 'A' | 'S';
  insigniasCount: number;
  trofeosCount: number;
  posicion: number;
}

export interface RankingParalelo {
  paralelo: 'A' | 'B';
  cursoPeriodoId: string;
  estudiantes: RankingEstudiante[];
  actualizadaEn: string;
}

export interface ResumenGamificacion {
  racha: RachasDiarias | null;
  puntosIndividuales: number;
  puntosCurso: number;
  nivel: number;
  rango: 'D' | 'C' | 'B' | 'A' | 'S';
  puntosSiguienteNivel: number;
  tag: string | null;
  puntosHoy: number;
  limiteDiario: number;
  insignias: InsigniaEstudiante[];
  trofeos: TrofeoEstudiante[];
  ranking: RankingEstudiante | null;
  aprendizajeHoy: Array<{ titulo: string; materiaNombre: string; porcentajeAcierto: number; aciertos: number; total: number; fechaFin: string | null; feedback: string | null }>;
  investigarSiguiente: string | null;
  desafiosDiarios: DesafioDiarioGamificacion[];
  bonoDesafiosOtorgado: boolean;
}

export interface DesafioDiarioGamificacion {
  codigo: 'resumen' | 'actividad' | 'puntos' | 'cartas' | 'esquema';
  nombre: string;
  completado: boolean;
}

export interface InfoEstudianteGamificacion {
  usuarioId: string;
  estudianteId: string;
  tag: string;
  cursoPeriodoId: string;
  paralelo: 'A' | 'B';
  nombre?: string;
  apellidoPaterno?: string;
  avatarUrl?: string | null;
}

export interface PreguntaActividad {
  id: string;
  texto: string;
  tipo: 'seleccion_multiple' | 'verdadero_falso' | 'conectar' | 'drag_drop' | 'cuestionario' | 'flashcards';
  opciones?: string[];
  respuestaCorrecta: string | string[];
  explicacion?: string;
  puntosBase: number;
  tiempoLimiteMs?: number;
  orden?: number;
}

export interface RespuestaActividad {
  preguntaId: string;
  respuesta: string | string[];
  correcta: boolean;
  tiempoMs: number;
  feedback?: string;
}

export interface CompletarActividadPayload {
  estudianteId: string;
  cursoPeriodoId: string;
  paralelo: 'A' | 'B';
  materiaId: string;
  materiaNombre: string;
  tipo: 'seleccion_multiple' | 'cuestionario' | 'flashcards' | 'verdadero_falso' | 'conectar_frases' | 'drag_drop';
  titulo: string;
  preguntas: PreguntaActividad[];
  respuestas: RespuestaActividad[];
  tiempoTotalMs: number;
  fechaInicio: string;
  fechaFin: string;
  contexto?: { materialId: string; temaRutaId?: string; numeroTema?: number; tituloTema?: string };
}

export interface ResultadoActividad {
  actividad: {
    id: string;
    puntosGanados: number;
    puntosCalidad: number;
    puntosTiempo: number;
    completada: boolean;
    porcentajeAcierto: number;
  };
  racha: RachasDiarias;
  puntosGanados: number;
  bonusSpeedrun?: number;
  speedrun?: boolean;
  insigniasNuevas: InsigniaEstudiante[];
  trofeosNuevos: TrofeoEstudiante[];
  bonoDesafios?: number;
}

export interface ProgresoEstudioPayload {
  contentId: string;
  materialId?: string;
  temaRutaId?: string;
  numeroTema?: number;
  tituloTema?: string;
  sesionId?: string;
  partesExplicadas?: string[];
  tiempoLecturaMs?: number;
  preguntaIndagacion?: string;
  titulo?: string;
  materiaNombre?: string;
  formato?: 'CARTAS_EXPLICATIVAS' | 'ESQUEMA_GEMMA';
  completo?: boolean;
  cartaActual?: number;
  totalCartas?: number;
  investigacion?: boolean;
}

export interface EvidenciaAprendizaje {
  actividades: Array<{ titulo: string; tipo: string; porcentaje: number; duracionMs: number; preguntasTotal?: number; tiempoPorPreguntaMs?: number; fecha: string | null; materialId?: string; temaRutaId?: string; numeroTema?: number; tituloTema?: string; respuestas?: unknown[]; preguntas?: unknown[] }>;
  eventosEstudio: Array<{ tipo: string; tema: string; contentId: string; materialId?: string; temaRutaId?: string; numeroTema?: number; tituloTema?: string; vecesRepetido?: number; tiempoLecturaMs?: number; partesExplicadas?: string[]; preguntaIndagacion?: string; formato: string | null; fecha: string | null }>;
  progresosTemas?: Array<{ materialId: string; temaRutaId: string; numeroTema: number; tituloTema: string; cartaActual: number; totalCartas: number; sesionId: string; tiempoLecturaMs: number; partesExplicadas: string[]; actualizadoEn: string }>;
  totalActividades: number;
  totalInvestigaciones: number;
  temasIndagados: string[];
  resumenesCompletados: number;
}

export const gamificacionApi = {
  getResumen: async (): Promise<ResumenGamificacion> => {
    return apiRequest<ResumenGamificacion>('/api/gamificacion/resumen');
  },

  getEvidenciaAprendizaje: async (): Promise<EvidenciaAprendizaje> => {
    return apiRequest<EvidenciaAprendizaje>('/api/gamificacion/aprendizaje/evidencia');
  },

  getInfoEstudiante: async (): Promise<InfoEstudianteGamificacion | null> => {
    return apiRequest<InfoEstudianteGamificacion | null>('/api/gamificacion/info-estudiante');
  },

  registrarPerfil: async (payload: Partial<InfoEstudianteGamificacion>): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/gamificacion/perfil', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  completarActividad: async (payload: CompletarActividadPayload): Promise<ResultadoActividad> => {
    return apiRequest<ResultadoActividad>('/api/gamificacion/actividad', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  registrarProgresoEstudio: async (payload: ProgresoEstudioPayload): Promise<{ puntosGanados: number; bonoDesafios: number }> => {
    return apiRequest<{ puntosGanados: number; bonoDesafios: number }>('/api/gamificacion/estudio', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  salvarRacha: async (): Promise<RachasDiarias> => {
    return apiRequest<RachasDiarias>('/api/gamificacion/racha/salvar', {
      method: 'POST',
    });
  },

  usarPista: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/api/gamificacion/pista', {
      method: 'POST',
    });
  },

  getTienda: async (): Promise<RecompensaTienda[]> => {
    return apiRequest<RecompensaTienda[]>('/api/gamificacion/tienda');
  },

  canjearRecompensa: async (recompensaId: string): Promise<CompraEstudiante> => {
    return apiRequest<CompraEstudiante>('/api/gamificacion/tienda/canjear', {
      method: 'POST',
      body: JSON.stringify({ recompensaId }),
    });
  },

  getRanking: async (cursoPeriodoId: string): Promise<RankingParalelo[]> => {
    return apiRequest<RankingParalelo[]>(`/api/gamificacion/ranking?cursoPeriodoId=${encodeURIComponent(cursoPeriodoId)}`);
  },
};
