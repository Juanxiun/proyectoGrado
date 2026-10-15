// config -> reglas y constantes de gamificacion
export const gamificationConfig = {
  // racha diaria
  racha: {
    umbralAcierto: 0.9, // 90%
    costoSalvarRacha: 100, // puntos individuales
  },

  // puntos individuales
  puntosIndividuales: {
    respuestaCorrecta: 5,
    leerResumen: 4,
    // calidad y tiempo se calculan en runtime
  },

  // pistas en examenes
  pistas: {
    costo: 95, // puntos individuales
  },

  // puntos globales / nivel curso
  puntosGlobales: {
    minPorDia: 3,
    maxPorDia: 5,
  },

  // meta diaria microlearning
  metaDiaria: {
    // analizada por ServiceAcademicLLMs
    minTemas: 3,
    maxTemas: 10,
  },

  // insignias
  insignias: {
    speedrun: { nombre: "Speedrun", descripcion: "Completar actividades en tiempo récord" },
    nuevoAprendizaje: { nombre: "Aprendiendo Nuevas Cosas", descripcion: "Explorar y repasar contenido nuevo" },
    repasoMasivo: { nombre: "Repaso Masivo", descripcion: "Superar la marca límite de la meta de aprendizaje diaria" },
    reincorporacion: { nombre: "Volver Donde Empecé", descripcion: "Reincorporarse tras un periodo inactivo" },
    mejorSemana: { nombre: "Mejor de la Semana", descripcion: "Mejor posicionado en la semana" },
    altoRendimiento: { nombre: "Alto Rendimiento del Trimestre", descripcion: "Rendimiento sobresaliente en el trimestre" },
    dominioTotal: { nombre: "Dominio Total", descripcion: "Dominio completo de la materia" },
  },

  // trofeos
  trofeos: {
    mejorSemana: { nombre: "Mejor de la Semana", puntos: 500 },
    altoRendimiento: { nombre: "Alto Rendimiento del Trimestre", puntos: 2000 },
    dominioTotal: { nombre: "Dominio Total", puntos: 5000 },
  },

  // actividades interactivas
  tiposActividad: [
    "seleccion_multiple",
    "cuestionario",
    "flashcards",
    "verdadero_falso",
    "conectar_frases",
    "drag_drop",
  ],

  // websocket eventos
  wsEventos: {
    actualizacionPuntos: "gamificacion:puntos_actualizados",
    actualizacionRacha: "gamificacion:racha_actualizada",
    insigniaGanada: "gamificacion:insignia_ganada",
    trofeoGanado: "gamificacion:trofeo_ganado",
    alertaRanking: "gamificacion:alerta_ranking",
    recompensaGlobal: "gamificacion:recompensa_global",
  },
};