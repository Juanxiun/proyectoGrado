// archivo -> servicios de reportes
export { getReporteAsistenciaCurso } from "./asistencia.service.ts";
export { getReporteCalificacionesMateria } from "./calificaciones.service.ts";

// reporte -> evaluar riesgo estudiante
export async function getReporteRiesgoEstudiante(estudianteId: string, cursoPeriodoId: string): Promise<Record<string, unknown>> {
  return {
    estudianteId,
    cursoPeriodoId,
    nivelRiesgo: "bajo",
    asistencia: 100,
    promedio: 100,
  };
}

// reporte -> ranking por materia
export async function getRankingMateria(materiaId: string, cursoPeriodoId: string, trimestre: number): Promise<unknown[]> {
  return [];
}

// reporte -> generar archivo pdf
export async function generarReportePDF(tipo: string, _datos: unknown): Promise<{ buffer: Uint8Array; nombre: string }> {
  return {
    buffer: new Uint8Array(),
    nombre: `reporte_${tipo}_${Date.now()}.pdf`,
  };
}
