import { Context } from "@oak/oak";
import {
  handleControllerError,
  parseNumericId,
  respond,
} from "../utils/http.ts";
import { requireEstudiante } from "../security/auth.ts";
import {
  procesarActividadCompletada,
  salvarRachaConPuntos,
  usarPistaExamen,
  getResumenEstudiante,
  getTienda,
  canjearRecompensa,
  getRanking,
  getInfoEstudianteGamificacion,
  upsertEstudianteGamificacion,
  registrarProgresoEstudio,
  getEvidenciaAprendizaje,
} from "../services/gamification.service.ts";
import { HttpError } from "../utils/errors.ts";

export async function getResumen(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const resumen = await getResumenEstudiante(claims.sub);
    respond(ctx, 200, resumen);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener resumen gamificacion");
  }
}

// controller -> evidencia de aprendizaje
export async function getEvidenciaAprendizajeController(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    respond(ctx, 200, await getEvidenciaAprendizaje(claims.sub));
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener evidencia de aprendizaje");
  }
}

export async function getInfoEstudiante(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const info = await getInfoEstudianteGamificacion(claims.sub);
    respond(ctx, 200, info);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener info estudiante");
  }
}

export async function completarActividad(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const body = await ctx.request.body.json();

    const resultado = await procesarActividadCompletada({
      usuarioId: claims.sub,
      estudianteId: body.estudianteId,
      cursoPeriodoId: body.cursoPeriodoId,
      paralelo: body.paralelo,
      materiaId: body.materiaId,
      materiaNombre: body.materiaNombre,
      tipo: body.tipo,
      titulo: body.titulo,
      preguntas: body.preguntas,
      respuestas: body.respuestas,
      tiempoTotalMs: body.tiempoTotalMs,
      fechaInicio: body.fechaInicio,
      fechaFin: body.fechaFin,
      contexto: body.contexto,
    });

    respond(ctx, 201, resultado);
  } catch (err) {
    handleControllerError(ctx, err, "Error al procesar actividad completada");
  }
}

// controller -> registrar progreso
export async function registrarProgresoEstudioController(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const body = await ctx.request.body.json();
    const resultado = await registrarProgresoEstudio(claims.sub, {
      contentId: String(body.contentId ?? ""),
      materialId: String(body.materialId ?? ""),
      temaRutaId: String(body.temaRutaId ?? ""),
      numeroTema: Number(body.numeroTema ?? 0),
      tituloTema: String(body.tituloTema ?? ""),
      sesionId: String(body.sesionId ?? ""),
      partesExplicadas: Array.isArray(body.partesExplicadas) ? body.partesExplicadas.map(String) : [],
      tiempoLecturaMs: Number(body.tiempoLecturaMs ?? 0),
      preguntaIndagacion: String(body.preguntaIndagacion ?? ""),
      titulo: String(body.titulo ?? ""),
      materiaNombre: String(body.materiaNombre ?? ""),
      formato: body.formato,
      completo: Boolean(body.completo),
      cartaActual: Number(body.cartaActual ?? 0),
      totalCartas: Number(body.totalCartas ?? 0),
      investigacion: Boolean(body.investigacion),
    });
    respond(ctx, 201, resultado);
  } catch (err) {
    handleControllerError(ctx, err, "Error al registrar progreso de estudio");
  }
}

export async function salvarRacha(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const racha = await salvarRachaConPuntos(claims.sub);
    respond(ctx, 200, racha);
  } catch (err) {
    handleControllerError(ctx, err, "Error al salvar racha");
  }
}

export async function usarPista(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    await usarPistaExamen(claims.sub);
    respond(ctx, 200, { message: "Pista utilizada correctamente" });
  } catch (err) {
    handleControllerError(ctx, err, "Error al usar pista");
  }
}

export async function getTiendaController(ctx: Context): Promise<void> {
  try {
    const tienda = await getTienda();
    respond(ctx, 200, tienda);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener tienda");
  }
}

export async function canjearRecompensaController(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const body = await ctx.request.body.json();
    const compra = await canjearRecompensa(claims.sub, body.recompensaId);
    respond(ctx, 201, compra);
  } catch (err) {
    handleControllerError(ctx, err, "Error al canjear recompensa");
  }
}

export async function getRankingController(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const params = ctx.request.url.searchParams;
    const cursoPeriodoId = params.get("cursoPeriodoId");
    if (!cursoPeriodoId) throw new HttpError(400, "cursoPeriodoId requerido");
    const ranking = await getRanking(cursoPeriodoId);
    respond(ctx, 200, ranking);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener ranking");
  }
}

export async function getInfo(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const info = await getInfoEstudianteGamificacion(claims.sub);
    respond(ctx, 200, info);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener info gamificacion");
  }
}

export async function registrarPerfilEstudiante(ctx: Context): Promise<void> {
  try {
    const claims = ctx.state.auth;
    const body = await ctx.request.body.json();
    await upsertEstudianteGamificacion({
      usuarioId: claims.sub,
      estudianteId: String(body.estudianteId),
      cursoPeriodoId: String(body.cursoPeriodoId),
      paralelo: body.paralelo,
      nombre: body.nombre ? String(body.nombre) : undefined,
      apellidoPaterno: body.apellidoPaterno ? String(body.apellidoPaterno) : undefined,
      avatarUrl: body.avatarUrl ? String(body.avatarUrl) : null,
    });
    respond(ctx, 200, { message: "Perfil de gamificacion guardado" });
  } catch (err) {
    handleControllerError(ctx, err, "Error al registrar perfil gamificacion");
  }
}

export const routes = [
  { method: "GET", path: "/gamificacion/resumen", handler: getResumen, middleware: [requireEstudiante()] },
  { method: "GET", path: "/gamificacion/aprendizaje/evidencia", handler: getEvidenciaAprendizajeController, middleware: [requireEstudiante()] },
  { method: "GET", path: "/gamificacion/info-estudiante", handler: getInfoEstudiante, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/perfil", handler: registrarPerfilEstudiante, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/actividad", handler: completarActividad, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/estudio", handler: registrarProgresoEstudioController, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/racha/salvar", handler: salvarRacha, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/pista", handler: usarPista, middleware: [requireEstudiante()] },
  { method: "GET", path: "/gamificacion/tienda", handler: getTiendaController, middleware: [requireEstudiante()] },
  { method: "POST", path: "/gamificacion/tienda/canjear", handler: canjearRecompensaController, middleware: [requireEstudiante()] },
  { method: "GET", path: "/gamificacion/ranking", handler: getRankingController, middleware: [requireEstudiante()] },
  { method: "GET", path: "/gamificacion/info", handler: getInfo, middleware: [requireEstudiante()] },
];
