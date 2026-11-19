import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  respond,
} from "../utils/http.ts";
import { requireControlAcademico } from "../security/auth.ts";
import {
  getReporteAsistenciaCurso,
  getReporteCalificacionesMateria,
  getReporteRiesgoEstudiante,
  getRankingMateria,
  generarReportePDF,
} from "../services/reportes.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function getReporteAsistenciaController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const cursoPeriodoId = params.get("cursoPeriodoId");
    const materiaId = params.get("materiaId");
    if (!cursoPeriodoId || !materiaId) throw new HttpError(400, "cursoPeriodoId y materiaId requeridos");
    const reporte = await getReporteAsistenciaCurso(cursoPeriodoId, materiaId);
    respond(ctx, 200, reporte);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar reporte de asistencia");
  }
}

export async function getReporteCalificacionesController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    const cursoPeriodoId = params.get("cursoPeriodoId");
    const trimestre = params.get("trimestre");
    if (!materiaId || !cursoPeriodoId || !trimestre) throw new HttpError(400, "materiaId, cursoPeriodoId y trimestre requeridos");
    const reporte = await getReporteCalificacionesMateria(materiaId, cursoPeriodoId, Number(trimestre));
    respond(ctx, 200, reporte);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar reporte de calificaciones");
  }
}

export async function getReporteRiesgoController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const estudianteId = params.get("estudianteId");
    const cursoPeriodoId = params.get("cursoPeriodoId");
    if (!estudianteId || !cursoPeriodoId) throw new HttpError(400, "estudianteId y cursoPeriodoId requeridos");
    const reporte = await getReporteRiesgoEstudiante(estudianteId, cursoPeriodoId);
    respond(ctx, 200, reporte);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar reporte de riesgo");
  }
}

export async function getRankingMateriaController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const materiaId = params.get("materiaId");
    const cursoPeriodoId = params.get("cursoPeriodoId");
    const trimestre = params.get("trimestre");
    if (!materiaId || !cursoPeriodoId || !trimestre) throw new HttpError(400, "materiaId, cursoPeriodoId y trimestre requeridos");
    const ranking = await getRankingMateria(params.get("materiaId")!, params.get("cursoPeriodoId")!, Number(params.get("trimestre")!));
    respond(ctx, 200, ranking);
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar ranking");
  }
}

export async function getReportePDFController(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const tipo = params.get("tipo") || "general";
    const datos = JSON.parse(params.get("datos") || "{}");
    const pdf = await generarReportePDF(tipo, datos);
    ctx.response.headers.set("Content-Type", "application/pdf");
    ctx.response.headers.set("Content-Disposition", `attachment; filename="${pdf.nombre}"`);
    ctx.response.body = pdf.buffer;
  } catch (err) {
    handleControllerError(ctx, err, "Error al generar PDF");
  }
}

export const routes = [
  { method: "GET", path: "/reportes/asistencia", handler: getReporteAsistenciaController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/reportes/calificaciones", handler: getReporteCalificacionesController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/reportes/riesgo", handler: getReporteRiesgoController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/reportes/ranking/materia", handler: getRankingMateriaController, middleware: [requireControlAcademico()] },
  { method: "GET", path: "/reportes/pdf", handler: getReportePDFController, middleware: [requireControlAcademico()] },
];