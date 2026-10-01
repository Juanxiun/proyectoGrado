import { Context } from "@oak/oak";
import {
  agregarMateriaGrado,
  listarGradosConMaterias,
  listarGradosSinMaterias,
  listarMateriasGrado,
  quitarMateriaGrado,
  reemplazarMateriasGrado,
} from "../../services/gradoMateria.service.ts";
import { NIVELES, type NivelEducativo } from "../../models/academic.ts";
import { HttpError } from "../../utils/errors.ts";
import {
  handleControllerError,
  parseNumericId,
  readJsonBody,
  respond,
  routeParam,
} from "../../utils/http.ts";
import type { AsignarMateriaGradoInput } from "../../models/academic.ts";

/**
 * Materias por GRADO. La interfaz de "Cursos base" muestra un bloque por
 * grado con todos sus paralelos juntos, porque la materia es la misma para
 * todos ellos.
 */

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

/** GET /grados/materias?nivel=&grado= */
export async function getMateriasGrado(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    respond(ctx, 200, await listarMateriasGrado(nivel, grado));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar las materias del grado");
  }
}

/** POST /grados/materias */
export async function postMateriaGrado(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const body = await readJsonBody<AsignarMateriaGradoInput>(ctx);
    respond(ctx, 201, await agregarMateriaGrado(nivel, grado, body));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al asignar la materia al grado");
  }
}

/** PUT /grados/materias — reemplaza el conjunto completo. */
export async function putMateriasGrado(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const body = await readJsonBody<{ materias: AsignarMateriaGradoInput[] }>(ctx);
    const materias = Array.isArray(body?.materias) ? body.materias : [];
    respond(ctx, 200, await reemplazarMateriasGrado(nivel, grado, materias));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al guardar las materias del grado");
  }
}

/** DELETE /grados/materias/:materiaId?nivel=&grado= */
export async function deleteMateriaGrado(ctx: Context): Promise<void> {
  try {
    const { nivel, grado } = nivelGrado(ctx);
    const materiaId = parseNumericId(
      routeParam(ctx, "materiaId") ?? ctx.request.url.searchParams.get("materiaId"),
      "materiaId",
    );
    respond(ctx, 200, await quitarMateriaGrado(nivel, grado, materiaId));
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al quitar la materia del grado");
  }
}

/** GET /grados?nivel= — grados con y sin materia, para la vista de cursos base. */
export async function getGrados(ctx: Context): Promise<void> {
  try {
    const nivelParam = ctx.request.url.searchParams.get("nivel");
    const nivel = nivelParam
      ? String(nivelParam).trim().toLowerCase() as NivelEducativo
      : undefined;
    if (nivel && !NIVELES.includes(nivel)) {
      throw new HttpError(400, `nivel debe ser uno de: ${NIVELES.join(", ")}`);
    }

    const [conMaterias, sinMaterias] = await Promise.all([
      listarGradosConMaterias(nivel),
      listarGradosSinMaterias(nivel),
    ]);

    respond(ctx, 200, { conMaterias, sinMaterias });
  } catch (err) {
    handleControllerError(ctx, err, "Error interno al listar los grados");
  }
}
