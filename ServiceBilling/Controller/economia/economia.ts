import { Context } from "@oak/oak";
import { handleControllerError, parsePagination, respond, routeParam } from "../../utils/http.ts";
import { getEconomyKpis, listEconomyStudents, getEconomyStudentDetail } from "../../connects/Database/queries.ts";

export async function getKpis(ctx: Context): Promise<void> {
  try {
    const value = ctx.request.url.searchParams.get("periodo_id");
    const periodoId = value ? Number(value) : undefined;
    respond(ctx, 200, await getEconomyKpis(periodoId));
  } catch (err) {
    handleControllerError(ctx, err, "Error al calcular los indicadores económicos");
  }
}

export async function listEconomy(ctx: Context): Promise<void> {
  try {
    const params = ctx.request.url.searchParams;
    const pagination = parsePagination(params);
    const periodo = params.get("periodo_id");
    const result = await listEconomyStudents({
      periodoId: periodo ? Number(periodo) : undefined,
      nivel: params.get("nivel") || undefined,
      grado: params.get("grado") || undefined,
      paralelo: params.get("paralelo") || undefined,
      filtroDeuda: params.get("filtro_deuda") || "todos",
      page: pagination.page,
      limit: pagination.limit,
    });
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al listar el estado económico de estudiantes");
  }
}

export async function getStudentDetail(ctx: Context): Promise<void> {
  try {
    const id = Number(routeParam(ctx, "id"));
    if (!Number.isSafeInteger(id) || id <= 0) {
      respond(ctx, 400, { error: "El ID del estudiante debe ser numérico" });
      return;
    }
    const result = await getEconomyStudentDetail(id);
    if (!result) {
      respond(ctx, 404, { error: "Estudiante no encontrado en la gestión activa" });
      return;
    }
    respond(ctx, 200, result);
  } catch (err) {
    handleControllerError(ctx, err, "Error al obtener el detalle económico del estudiante");
  }
}
