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
  recompensaId: string;
  puntosGastados: number;
  fechaCompra: string;
  usada: boolean;
  fechaUso?: string;
}

export interface RankingEstudiante {
  usuarioId: string;
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  avatarUrl?: string | null;
  rachaActual: number;
  mejorRacha: number;
  promedioRendimiento: number;
  calidadPromedio: number;
  tiempoPromedioMs: number;
  puntosIndividuales: number;
  puntosGlobales: number;
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
  puntosGlobales: number;
  insignias: InsigniaEstudiante[];
  trofeos: TrofeoEstudiante[];
  ranking: RankingEstudiante | null;
}

export interface InfoEstudianteGamificacion {
  usuarioId: string;
  estudianteId: string;
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
  insigniasNuevas: InsigniaEstudiante[];
  trofeosNuevos: TrofeoEstudiante[];
}

export const gamificacionApi = {
  getResumen: async (): Promise<ResumenGamificacion> => {
    return apiRequest<ResumenGamificacion>('/gamificacion/resumen');
  },

  getInfoEstudiante: async (): Promise<InfoEstudianteGamificacion | null> => {
    return apiRequest<InfoEstudianteGamificacion | null>('/gamificacion/info-estudiante');
  },

  registrarPerfil: async (payload: Partial<InfoEstudianteGamificacion>): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/gamificacion/perfil', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  completarActividad: async (payload: CompletarActividadPayload): Promise<ResultadoActividad> => {
    return apiRequest<ResultadoActividad>('/gamificacion/actividad', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  salvarRacha: async (): Promise<RachasDiarias> => {
    return apiRequest<RachasDiarias>('/gamificacion/racha/salvar', {
      method: 'POST',
    });
  },

  usarPista: async (): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/gamificacion/pista', {
      method: 'POST',
    });
  },

  getTienda: async (): Promise<RecompensaTienda[]> => {
    return apiRequest<RecompensaTienda[]>('/gamificacion/tienda');
  },

  canjearRecompensa: async (recompensaId: string): Promise<CompraEstudiante> => {
    return apiRequest<CompraEstudiante>('/gamificacion/tienda/canjear', {
      method: 'POST',
      body: JSON.stringify({ recompensaId }),
    });
  },

  getRanking: async (cursoPeriodoId: string): Promise<RankingParalelo[]> => {
    return apiRequest<RankingParalelo[]>(`/gamificacion/ranking?cursoPeriodoId=${encodeURIComponent(cursoPeriodoId)}`);
  },
};
