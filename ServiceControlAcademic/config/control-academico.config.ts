// config -> reglas y constantes de control academico
export const controlAcademicoConfig = {
  // asistencia
  asistencia: {
    estados: ["presente", "ausente", "atraso", "justificado"] as const,
    horaLimiteAtrasoMinutos: 15, // minutos despues de inicio de clase para considerar atraso
  },

  // calificaciones
  calificaciones: {
    notaMinima: 0,
    notaMaxima: 100,
    notaAprobacion: 51,
    ponderacionMaxima: 100,
    tiposExamen: ["parcial", "final", "trimestral", "bimestral"] as const,
    trimestres: [1, 2, 3] as const,
  },

  // malla curricular - restricciones
  mallaCurricular: {
    validarPorMalla: true,
    soloTemasActivos: true,
    evaluarSoloTemasMalla: true,
  },

  // websocket eventos
  wsEventos: {
    asistenciaRegistrada: "control:asistencia_registrada",
    asistenciaActualizada: "control:asistencia_actualizada",
    calificacionRegistrada: "control:calificacion_registrada",
    calificacionActualizada: "control:calificacion_actualizada",
    temaCompletado: "control:tema_completado",
    examenRegistrado: "control:examen_registrado",
    alertaRiesgo: "control:alerta_riesgo",
    reporteGenerado: "control:reporte_generado",
  },

  // horarios - validacion
  horarios: {
    validarHorarioClase: true,
    toleranciaMinutos: 10, // tolerancia para validar si el maestro tiene clase en ese momento
  },

  // reportes
  reportes: {
    generarPDF: true,
    incluirGraficos: true,
  },
};