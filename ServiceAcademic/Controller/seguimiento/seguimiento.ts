import { Context } from "@oak/oak";
import {
  esTrimestreValido,
  listarRiesgo,
  obtenerLibro,
  obtenerPanelCurso,
  obtenerPanelEstudiante,
} from "../../services/seguimiento.service.ts";
import { seguimientoConfig } from "../../config/seguimiento.config.ts";
import { HttpError } from "../../utils/errors.ts";
import {
  handleControllerError,
  parseNumericId,
  respond,
  routeParam,
} from "../../utils/http.ts";

/**
 * Módulo de seguimiento académico. Las notas se calculan en vivo: un cambio de
 * ponderación o una corrección de tarea se refleja de inmediato, sin proceso
 * de cierre ni tabla intermedia.
 */

function requeridos(params: URLSearchParams, ...nombres: string[]): void {
  for (const nombre of nombres) {
    if (!params.get(nombre)) {
      throw new HttpError(400, `${nombre} es requerido`);
    }
  }
}

function trimestreDe(params: URLSearchParams): number {
  const valor = params.get("trimestre");
  if (!valor) throw new HttpError(400, "trimestre es requerido (1, 2 o 3)");
  if (!esTrimestreValido(valor)) {
    throw new HttpError(400, "trimestre debe ser 1, 2 o 3");
  }
  return Number(valor);
}

/** GET /seguimiento/libro?cursoPeriodoId=&materiaId=&trimestre= */
export async function getLibro(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    requeridos(params, "cursoPeriodoId", "materiaId", "trimestre");

    respond(ctx, 200, await obtenerLibro({
      cursoPeriodoId: params.get("cursoPeriodoId") as string,
      materiaId: params.get("materiaId") as string,
      trimestre: trimestreDe(params),
    }));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el libro de notas");
  }
}

/** GET /seguimiento/panel/curso?cursoPeriodoId=&trimestre= */
export async function getPanelCurso(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    requeridos(params, "cursoPeriodoId", "trimestre");

    respond(ctx, 200, await obtenerPanelCurso({
      cursoPeriodoId: params.get("cursoPeriodoId") as string,
      trimestre: trimestreDe(params),
    }));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el panel del curso");
  }
}

/** GET /seguimiento/panel/estudiante/:id?periodoId=&trimestre= */
export async function getPanelEstudiante(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    requeridos(params, "periodoId", "trimestre");

    const estudianteId = parseNumericId(
      routeParam(ctx, "id") ?? params.get("estudianteId"),
      "estudianteId",
    );

    respond(ctx, 200, await obtenerPanelEstudiante(
      estudianteId,
      params.get("periodoId") as string,
      trimestreDe(params),
    ));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el panel del estudiante");
  }
}

/** GET /seguimiento/riesgo?periodoId=&trimestre=&limite= */
export async function getRiesgo(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    requeridos(params, "periodoId", "trimestre");

    const limite = Number(params.get("limite") ?? 100);
    const alertas = await listarRiesgo({
      periodoId: params.get("periodoId") as string,
      trimestre: trimestreDe(params),
      limite: Number.isFinite(limite) ? limite : 100,
    });

    respond(ctx, 200, {
      total: alertas.length,
      umbrales: seguimientoConfig,
      alertas,
    });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener las alertas de riesgo");
  }
}

/** GET /seguimiento/umbrales — criterio vigente, para mostrarlo en la interfaz. */
export async function getUmbrales(ctx: Context): Promise<void> {
  try {
    respond(ctx, 200, seguimientoConfig);
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener los umbrales");
  }
}
