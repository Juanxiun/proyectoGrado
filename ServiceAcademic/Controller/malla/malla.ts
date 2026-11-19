import { Context } from "@oak/oak";
import {
  actualizarTema,
  crearTema,
  eliminarTema,
  guardarTemasMateria,
  listarTemasMateria,
  obtenerMallaGrado,
  resumenMalla,
} from "../../services/malla.service.ts";
import { NIVELES, type NivelEducativo } from "../../models/academic.ts";
import { HttpError } from "../../utils/errors.ts";
import {
  handleControllerError,
  parseNumericId,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import type { CrearTemaInput } from "../../models/academic.ts";

// control -> temas malla por grado

function nivelGrado(ctx: Context): { nivel: NivelEducativo; grado: string } {
  const params = ctx.request.url.searchParams;

  const nivel = String(
    routeParam(ctx, "nivel") ?? params.get("nivel") ?? "",
  ).trim().toLowerCase() as NivelEducativo;
  if (!NIVELES.includes(nivel)) {
    throw new HttpError(400, `nivel debe ser uno de: ${NIVELES.join(", ")}`);
  }

  const grado = String(routeParam(ctx, "grado") ?? params.get("grado") ?? "").trim();
  if (!grado) throw new HttpError(400, "grado es requerido");

  return { nivel, grado };
}

// ruta -> listar malla grado
export async function getMalla(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    respond(ctx, 200, await obtenerMallaGrado(nivel, grado));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener la maya curricular");
  }
}

// ruta -> resumen malla grado
export async function getMallaResumen(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    respond(ctx, 200, await resumenMalla(nivel, grado));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener el resumen de la malla");
  }
}

// ruta -> temas materia malla
export async function getMallaMateria(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const materiaId = parseNumericId(
      ctx.request.url.searchParams.get("materiaId"),
      "materiaId",
    );
    respond(ctx, 200, await listarTemasMateria(nivel, grado, materiaId));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al obtener los temas de la materia");
  }
}

// ruta -> crear tema malla
export async function postTema(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const body = await readJsonBody<CrearTemaInput>(ctx);
    respond(ctx, 201, await crearTema(nivel, grado, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al crear el tema");
  }
}

// ruta -> actualizar tema malla
export async function putTema(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(
      routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"),
      "id",
    );
    const body = await readJsonBody<Partial<CrearTemaInput>>(ctx);
    respond(ctx, 200, await actualizarTema(id, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al actualizar el tema");
  }
}

// ruta -> eliminar tema malla
export async function deleteTema(ctx: Context): Promise<void> {
  try {
    const id = parseNumericId(
      routeParam(ctx, "id") ?? ctx.request.url.searchParams.get("id"),
      "id",
    );
    await eliminarTema(id);
    respond(ctx, 200, { message: `Tema id=${id} eliminado` });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al eliminar el tema");
  }
}

// ruta -> guardar temario completo
export async function putMallaMateria(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const materiaId = parseNumericId(
      ctx.request.url.searchParams.get("materiaId"),
      "materiaId",
    );
    const body = await readJsonBody<{ temas: Array<any> }>(ctx);
    const temas = Array.isArray(body?.temas) ? body.temas : [];
    respond(ctx, 200, await guardarTemasMateria(nivel, grado, materiaId, temas));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al guardar la malla de la materia");
  }
}