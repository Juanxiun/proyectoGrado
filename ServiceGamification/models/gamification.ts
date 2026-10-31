// models -> tipos de gamificacion
export interface EstudianteGamificacion {
  id?: string;
  usuarioId: string;
  estudianteId: string;
  tag: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
  nombre?: string;
  apellidoPaterno?: string;
  avatarUrl?: string | null;
  estado?: string;
}

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
  paralelo?: "A" | "B";
  fecha: string;
  tipo: "respuesta_correcta" | "leer_resumen" | "salvar_racha" | "pista_examen" | "ajuste_manual" | "canje_tienda";
  puntos: number;
  descripcion: string;
  metadata?: Record<string, unknown>;
  creadaEn: string;
}

export interface PuntosGlobales {
  id: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
  fecha: string;
  puntosGanados: number;
  descripcion: string;
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
  periodo: "semanal" | "trimestral" | "anual";
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
  tipo: "pista_examen" | "salvar_racha" | "cosmetico" | "otro";
  iconoUrl?: string;
  stock: number | null;
  activa: boolean;
}

export interface CompraEstudiante {
  id: string;
  usuarioId: string;
  cursoPeriodoId?: string;
  paralelo?: "A" | "B";
  recompensaId: string;
  puntosGastados: number;
  fechaCompra: string;
  usada: boolean;
  fechaUso?: string;
}

export interface ActividadGamificada {
  id: string;
  usuarioId: string;
  estudianteId: string;
  cursoPeriodoId?: string;
  paralelo?: "A" | "B";
  tipo: "seleccion_multiple" | "cuestionario" | "flashcards" | "verdadero_falso" | "conectar_frases" | "drag_drop";
  materiaId: string;
  materiaNombre: string;
  titulo: string;
  preguntas: PreguntaGamificada[];
  respuestas: RespuestaGamificada[];
  aciertos: number;
  total: number;
  porcentajeAcierto: number;
  tiempoTotalMs: number;
  puntosGanados: number;
  puntosCalidad: number;
  puntosTiempo: number;
  completada: boolean;
  fechaInicio: string;
  fechaFin?: string;
  contexto?: { materialId?: string; temaRutaId?: string; numeroTema?: number; tituloTema?: string };
}

export interface PreguntaGamificada {
  id: string;
  texto: string;
  tipo: "seleccion_multiple" | "verdadero_falso" | "conectar" | "drag_drop";
  opciones?: string[];
  respuestaCorrecta: string | string[];
  explicacion?: string;
  puntosBase: number;
  tiempoLimiteMs?: number;
  orden?: number;
}

export interface RespuestaGamificada {
  preguntaId: string;
  respuesta: string | string[];
  correcta: boolean;
  tiempoMs: number;
  puntosGanados: number;
  puntosCalidad: number;
  puntosTiempo: number;
  feedback?: string;
}

export interface RankingParalelo {
  paralelo: "A" | "B";
  cursoPeriodoId: string;
  estudiantes: RankingEstudiante[];
  actualizadaEn: string;
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
  rango: "D" | "C" | "B" | "A" | "S";
  insigniasCount: number;
  trofeosCount: number;
  posicion: number;
}

export interface EventoGamificacion {
  tipo: string;
  usuarioId: string;
  estudianteId?: string;
  cursoPeriodoId?: string;
  paralelo?: "A" | "B";
  payload: Record<string, unknown>;
  timestamp: string;
}
