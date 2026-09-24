import { query, sTransaction } from "../connects/Database/transaction.ts";
import { crearGestionPeriodo } from "./gestion.service.ts";
import {
  CreatePeriodoInput,
  PaginatedResult,
  PaginationQuery,
  PeriodoAcademico,
  UpdatePeriodoInput,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";
import { isIsoDate } from "../utils/http.ts";
import { validateTrimestres } from "../utils/gestionValidation.ts";

interface PeriodoRow {
  id: bigint;
  anio: number;
  nombre: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  inicioGestion?: Date | string;
  finGestion?: Date | string;
  estado?: string;
  origenPeriodoId?: bigint | null;
  estructuraGenerada?: boolean;
  horariosGenerados?: boolean;
  planPagosGenerado?: boolean;
  activo: boolean;
  fechaCreacion: Date | string;
}

function mapPeriodo(row: PeriodoRow): PeriodoAcademico {
  return serialize({
    id: toId(row.id),
    anio: Number(row.anio),
    nombre: row.nombre,
    fechaInicio: asDateString(row.fechaInicio),
    fechaFin: asDateString(row.fechaFin),
    inicioGestion: asDateString(row.inicioGestion ?? row.fechaInicio),
    finGestion: asDateString(row.finGestion ?? row.fechaFin),
    estado: String(row.estado ?? (row.activo ? "activo" : "configuracion")),
    origenPeriodoId: row.origenPeriodoId ? toId(row.origenPeriodoId) : null,
    estructuraGenerada: Boolean(row.estructuraGenerada),
    horariosGenerados: Boolean(row.horariosGenerados),
    planPagosGenerado: Boolean(row.planPagosGenerado),
    activo: Boolean(row.activo),
    fechaCreacion: asDateString(row.fechaCreacion),
  });
}

function validatePeriodo(input: CreatePeriodoInput | UpdatePeriodoInput, partial = false): void {
  if (!partial || input.anio !== undefined) {
    const anio = Number(input.anio);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      throw new HttpError(400, "anio debe ser un entero entre 2000 y 2100");
    }
  }
  if (!partial || input.nombre !== undefined) {
    if (!String(input.nombre ?? "").trim()) {
      throw new HttpError(400, "nombre es obligatorio");
    }
  }
  const inicio = input.inicioGestion ?? input.fechaInicio;
  const fin = input.finGestion ?? input.fechaFin;
  if (!partial || inicio !== undefined) {
    if (!isIsoDate(inicio)) throw new HttpError(400, "inicio_gestion debe tener formato YYYY-MM-DD");
  }
  if (!partial || fin !== undefined) {
    if (!isIsoDate(fin)) throw new HttpError(400, "fin_gestion debe tener formato YYYY-MM-DD");
  }
}

function assertDateRange(inicio: string, fin: string): void {
  if (new Date(fin) <= new Date(inicio)) {
    throw new HttpError(400, "fin_gestion debe ser estrictamente posterior a inicio_gestion");
  }
}

const SELECT = `
  SELECT
    id,
    anio,
    nombre,
    fecha_inicio AS "fechaInicio",
    fecha_fin AS "fechaFin",
    inicio_gestion AS "inicioGestion",
    fin_gestion AS "finGestion",
    estado,
    origen_periodo_id AS "origenPeriodoId",
    estructura_generada AS "estructuraGenerada",
    horarios_generados AS "horariosGenerados",
    plan_pagos_generado AS "planPagosGenerado",
    activo,
    fecha_creacion AS "fechaCreacion"
  FROM periodos_academicos
`;

export async function listPeriodos(
  pagination: PaginationQuery,
  filters: { anio?: string; activo?: string; buscar?: string; viewerRole?: string },
): Promise<PaginatedResult<PeriodoAcademico>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.anio) {
    if (!/^\d+$/.test(filters.anio)) throw new HttpError(400, "anio debe ser numérico");
    conditions.push(`anio = $${idx++}`);
    params.push(Number(filters.anio));
  }
  if (filters.activo === "true" || filters.activo === "false") {
    conditions.push(`activo = $${idx++}`);
    params.push(filters.activo === "true");
  }
  if (filters.buscar) {
    conditions.push(`nombre ILIKE $${idx++}`);
    params.push(`%${filters.buscar}%`);
  }
  if (filters.viewerRole === "estudiante") conditions.push("activo = true", "estado = 'activo'");

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<PeriodoRow>(
        `${SELECT} ${where} ORDER BY anio DESC, fecha_inicio DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM periodos_academicos ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapPeriodo),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar periodos académicos");
  }
}

export async function getPeriodoById(id: string): Promise<PeriodoAcademico> {
  const res = await query<PeriodoRow>(`${SELECT} WHERE id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Periodo académico id=${id} no encontrado`);
  }
  return mapPeriodo(res.rows[0]);
}

export function createPeriodo(input: CreatePeriodoInput): Promise<PeriodoAcademico> {
  return crearGestionPeriodo(input);
}

export async function updatePeriodo(id: string, input: UpdatePeriodoInput): Promise<PeriodoAcademico> {
  const current = await getPeriodoById(id);
  if (current.estado === "activo" || current.estado === "cerrado" || current.estado === "cancelado") {
    throw new HttpError(409, "Una gestión activa o cerrada no puede editarse; clone una nueva gestión");
  }
  if (input.activo !== undefined && typeof input.activo !== "boolean") {
    throw new HttpError(400, "activo debe ser booleano");
  }
  if (input.activo === true) {
    throw new HttpError(400, "Use POST /periodos/:id/activar después de completar la configuración");
  }
  validatePeriodo(input, true);

  if (input.inicioGestion && input.fechaInicio && input.inicioGestion !== input.fechaInicio) {
    throw new HttpError(400, "fechaInicio y inicio_gestion no son consistentes");
  }
  if (input.finGestion && input.fechaFin && input.finGestion !== input.fechaFin) {
    throw new HttpError(400, "fechaFin y fin_gestion no son consistentes");
  }
  const rawInput = input as UpdatePeriodoInput & Record<string, unknown>;
  const fechaInicio = String(input.inicioGestion ?? input.fechaInicio ?? rawInput.inicio_gestion ?? rawInput.fecha_inicio ?? current.inicioGestion);
  const fechaFin = String(input.finGestion ?? input.fechaFin ?? rawInput.fin_gestion ?? rawInput.fecha_fin ?? current.finGestion);
  if (!isIsoDate(fechaInicio)) throw new HttpError(400, "inicio_gestion debe tener formato YYYY-MM-DD");
  if (!isIsoDate(fechaFin)) throw new HttpError(400, "fin_gestion debe tener formato YYYY-MM-DD");
  assertDateRange(fechaInicio, fechaFin);
  const datesChanged = input.inicioGestion !== undefined || input.finGestion !== undefined || input.fechaInicio !== undefined || input.fechaFin !== undefined || rawInput.inicio_gestion !== undefined || rawInput.fin_gestion !== undefined || rawInput.fecha_inicio !== undefined || rawInput.fecha_fin !== undefined;
  let requestedTrimestres = input.trimestres ?? (
    input.inicio1T !== undefined || input.fin1T !== undefined || input.inicio2T !== undefined || input.fin2T !== undefined || input.inicio3T !== undefined || input.fin3T !== undefined || input.inicio1 !== undefined || input.fin1 !== undefined || input.inicio2 !== undefined || input.fin2 !== undefined || input.inicio3 !== undefined || input.fin3 !== undefined || rawInput.inicio_1T !== undefined || rawInput.fin_1T !== undefined || rawInput.inicio_2T !== undefined || rawInput.fin_2T !== undefined || rawInput.inicio_3T !== undefined || rawInput.fin_3T !== undefined || rawInput.inicio_1 !== undefined || rawInput.fin_1 !== undefined || rawInput.inicio_2 !== undefined || rawInput.fin_2 !== undefined || rawInput.inicio_3 !== undefined || rawInput.fin_3 !== undefined
      ? [
        { numero: 1 as const, inicio: String(input.inicio1T ?? input.inicio1 ?? rawInput.inicio_1T ?? rawInput.inicio_1 ?? ""), fin: String(input.fin1T ?? input.fin1 ?? rawInput.fin_1T ?? rawInput.fin_1 ?? "") },
        { numero: 2 as const, inicio: String(input.inicio2T ?? input.inicio2 ?? rawInput.inicio_2T ?? rawInput.inicio_2 ?? ""), fin: String(input.fin2T ?? input.fin2 ?? rawInput.fin_2T ?? rawInput.fin_2 ?? "") },
        { numero: 3 as const, inicio: String(input.inicio3T ?? input.inicio3 ?? rawInput.inicio_3T ?? rawInput.inicio_3 ?? ""), fin: String(input.fin3T ?? input.fin3 ?? rawInput.fin_3T ?? rawInput.fin_3 ?? "") },
      ]
      : undefined
  );
  if (requestedTrimestres === undefined && datesChanged) {
    const currentTrimesters = await query<{ numero: 1 | 2 | 3; inicio: Date | string; fin: Date | string }>(
      `SELECT numero, inicio, fin FROM trimestres WHERE periodo_id = $1 ORDER BY numero`,
      [id],
    );
    requestedTrimestres = currentTrimesters.rows.map((row) => ({
      numero: row.numero,
      inicio: asDateString(row.inicio),
      fin: asDateString(row.fin),
    }));
  }
  if (requestedTrimestres !== undefined) {
    validateTrimestres(fechaInicio, fechaFin, requestedTrimestres);
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.anio !== undefined) {
    fields.push(`anio = $${idx++}`);
    params.push(Number(input.anio));
  }
  if (input.nombre !== undefined) {
    fields.push(`nombre = $${idx++}`);
    params.push(String(input.nombre).trim());
  }
  if (input.inicioGestion !== undefined || input.fechaInicio !== undefined || rawInput.inicio_gestion !== undefined || rawInput.fecha_inicio !== undefined) {
    fields.push(`fecha_inicio = $${idx++}`, `inicio_gestion = $${idx++}`);
    params.push(fechaInicio, fechaInicio);
  }
  if (input.finGestion !== undefined || input.fechaFin !== undefined || rawInput.fin_gestion !== undefined || rawInput.fecha_fin !== undefined) {
    fields.push(`fecha_fin = $${idx++}`, `fin_gestion = $${idx++}`);
    params.push(fechaFin, fechaFin);
  }
  if (datesChanged || requestedTrimestres !== undefined) {
    fields.push("horarios_generados = false", "plan_pagos_generado = false");
  }
  if (input.activo !== undefined) {
    fields.push(`activo = $${idx++}`, `estado = $${idx++}`);
    params.push(Boolean(input.activo), input.activo ? "activo" : "configuracion");
  }

  if (fields.length === 0 && requestedTrimestres === undefined) {
    throw new HttpError(400, "No hay campos para actualizar");
  }

  try {
    let updated = current;
    await sTransaction(async (tx) => {
      const locked = await tx.queryObject<{ estado: string; activo: boolean }>(
        `SELECT estado, activo FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!locked.rows.length || locked.rows[0].activo || !["configuracion", "borrador"].includes(locked.rows[0].estado)) {
        throw new HttpError(409, "La gestión cambió de estado y ya no puede editarse");
      }
      if (fields.length > 0) {
        params.push(id);
        const res = await tx.queryObject<PeriodoRow>(
          `UPDATE periodos_academicos SET ${fields.join(", ")}
           WHERE id = $${idx}
           RETURNING
             id, anio, nombre,
             fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin",
             inicio_gestion AS "inicioGestion", fin_gestion AS "finGestion",
             estado, origen_periodo_id AS "origenPeriodoId",
             estructura_generada AS "estructuraGenerada",
             horarios_generados AS "horariosGenerados",
             plan_pagos_generado AS "planPagosGenerado",
             activo, fecha_creacion AS "fechaCreacion"`,
          params,
        );
        updated = mapPeriodo(res.rows[0]);
      }
      if (requestedTrimestres !== undefined) {
        await tx.queryObject(`DELETE FROM trimestres WHERE periodo_id = $1`, [id]);
        for (const trimestre of requestedTrimestres) {
          await tx.queryObject(
            `INSERT INTO trimestres (periodo_id, numero, inicio, fin) VALUES ($1, $2, $3, $4)`,
            [id, trimestre.numero, trimestre.inicio, trimestre.fin],
          );
        }
      }
    });
    return updated;
  } catch (err) {
    throw mapDbError(err, "Error al actualizar el periodo académico");
  }
}

export interface DeletePeriodoResult {
  id: string;
  nombre: string;
  cursos: number;
  inscripciones: number;
  estudiantes: number;
  pensiones: number;
  pagos: number;
  horarios: number;
  asignaciones: number;
  materiales: number;
  encargos: number;
  notas: number;
  asistencia: number;
  planes: number;
}

/**
 * Elimina una gestión y todos los registros que pertenecen exclusivamente a ella.
 *
 * La base es compartida por los servicios Deno, por lo que no se delega el
 * borrado en cascada de PostgreSQL: primero se retiran las filas hijas que
 * tienen llaves RESTRICT (evaluaciones, asistencia, pagos e inscripciones)
 * y después se eliminan los recursos de la gestión. Los estudiantes que
 * todavía tengan datos en otra gestión se conservan; los que sólo existen
 * en esta gestión se retiran de la tabla de dominio sin borrar su cuenta
 * de usuario.
 */
export async function deletePeriodo(id: string): Promise<DeletePeriodoResult> {
  try {
    return await sTransaction(async (tx) => {
      const period = await tx.queryObject<{ nombre: string }>(
        `SELECT nombre FROM periodos_academicos WHERE id = $1 FOR UPDATE`,
        [id],
      );
      if (!period.rows[0]) {
        throw new HttpError(404, `Periodo académico id=${id} no encontrado`);
      }

      const ids = async (sql: string, params: unknown[] = []): Promise<string[]> => {
        const result = await tx.queryObject<{ id: bigint }>(sql, params);
        return result.rows.map((row) => String(row.id));
      };
      const coursePeriodIds = await ids(
        `SELECT id FROM cursos_periodo WHERE periodo_id = $1::bigint`,
        [id],
      );
      const assignmentIds = await ids(
        `SELECT id FROM asignaciones_docentes WHERE curso_periodo_id = ANY($1::bigint[])`,
        [coursePeriodIds],
      );
      const assignmentChargeIds = await ids(
        `SELECT id FROM encargos WHERE asignacion_id = ANY($1::bigint[])`,
        [assignmentIds],
      );
      const pensionIds = await ids(
        `SELECT id FROM pensiones WHERE periodo_id = $1::bigint`,
        [id],
      );
      const paymentIds = await ids(
        `SELECT DISTINCT pp.pago_id AS id
         FROM pago_pensiones pp
         WHERE pp.pension_id = ANY($1::bigint[])`,
        [pensionIds],
      );
      const studentIdsResult = await tx.queryObject<{ id: bigint }>(
        `SELECT DISTINCT estudiante_id AS id
           FROM (
             SELECT estudiante_id FROM inscripciones WHERE periodo_id = $1::bigint
             UNION
             SELECT estudiante_id FROM pensiones WHERE periodo_id = $1::bigint
             UNION
             SELECT estudiante_id FROM solicitudes_inscripcion WHERE periodo_id = $1::bigint
           ) AS estudiantes_periodo`,
        [id],
      );
      const studentIds = studentIdsResult.rows.map((row) => String(row.id));

      const counts = await tx.queryObject<{
        cursos: string;
        inscripciones: string;
        estudiantes: string;
        pensiones: string;
        pagos: string;
        horarios: string;
        asignaciones: string;
        materiales: string;
        encargos: string;
        notas: string;
        asistencia: string;
        planes: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM cursos_periodo WHERE periodo_id = $1::bigint) AS cursos,
           (SELECT COUNT(*) FROM inscripciones WHERE periodo_id = $1::bigint) AS inscripciones,
           (SELECT COUNT(*) FROM estudiantes e WHERE e.id = ANY($2::bigint[])) AS estudiantes,
           (SELECT COUNT(*) FROM pensiones WHERE periodo_id = $1::bigint) AS pensiones,
           (SELECT COUNT(*) FROM pagos WHERE id = ANY($6::bigint[])) AS pagos,
           (SELECT COUNT(*) FROM horarios WHERE curso_periodo_id = ANY($3::bigint[])) AS horarios,
           (SELECT COUNT(*) FROM asignaciones_docentes WHERE curso_periodo_id = ANY($3::bigint[])) AS asignaciones,
           (SELECT COUNT(*) FROM materia_materiales WHERE asignacion_id = ANY($4::bigint[])) AS materiales,
           (SELECT COUNT(*) FROM encargos WHERE asignacion_id = ANY($4::bigint[])) AS encargos,
           (SELECT COUNT(*) FROM calificaciones WHERE encargo_id = ANY($5::bigint[])) AS notas,
           (SELECT COUNT(*) FROM asistencia WHERE asignacion_id = ANY($4::bigint[])) AS asistencia,
           (SELECT COUNT(*) FROM planes_pago WHERE periodo_id = $1::bigint) AS planes`,
        [id, studentIds, coursePeriodIds, assignmentIds, assignmentChargeIds, paymentIds],
      );
      const row = counts.rows[0];

      // Primero se deshacen las relaciones académicas y financieras que usan
      // RESTRICT en instalaciones antiguas.
      if (pensionIds.length) {
        await tx.queryObject(`DELETE FROM pago_pensiones WHERE pension_id = ANY($1::bigint[])`, [pensionIds]);
      }
      if (assignmentChargeIds.length) {
        await tx.queryObject(`DELETE FROM calificaciones WHERE encargo_id = ANY($1::bigint[])`, [assignmentChargeIds]);
        await tx.queryObject(`DELETE FROM encargo_entregas WHERE encargo_id = ANY($1::bigint[])`, [assignmentChargeIds]);
      }
      if (assignmentIds.length) {
        await tx.queryObject(`DELETE FROM asistencia WHERE asignacion_id = ANY($1::bigint[])`, [assignmentIds]);
      }
      if (assignmentChargeIds.length) {
        await tx.queryObject(`DELETE FROM encargo_materiales WHERE encargo_id = ANY($1::bigint[])`, [assignmentChargeIds]);
        await tx.queryObject(`DELETE FROM encargos WHERE id = ANY($1::bigint[])`, [assignmentChargeIds]);
      }
      if (assignmentIds.length) {
        await tx.queryObject(`DELETE FROM materia_materiales WHERE asignacion_id = ANY($1::bigint[])`, [assignmentIds]);
      }
      if (coursePeriodIds.length) {
        await tx.queryObject(`DELETE FROM curso_asesor WHERE curso_periodo_id = ANY($1::bigint[])`, [coursePeriodIds]);
        await tx.queryObject(`DELETE FROM horarios WHERE curso_periodo_id = ANY($1::bigint[])`, [coursePeriodIds]);
        await tx.queryObject(`DELETE FROM asignaciones_docentes WHERE curso_periodo_id = ANY($1::bigint[])`, [coursePeriodIds]);
      }

      if (coursePeriodIds.length) {
        await tx.queryObject(
          `DELETE FROM solicitudes_inscripcion WHERE curso_periodo_destino_id = ANY($1::bigint[])`,
          [coursePeriodIds],
        );
        await tx.queryObject(
          `DELETE FROM inscripciones WHERE curso_periodo_id = ANY($1::bigint[])`,
          [coursePeriodIds],
        );
      }
      await tx.queryObject(`DELETE FROM solicitudes_inscripcion WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM inscripciones WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM pensiones WHERE periodo_id = $1::bigint`, [id]);

      // Un pago que sólo financiaba pensiones de esta gestión se elimina;
      // los pagos que todavía financian otra gestión se conservan.
      if (paymentIds.length) {
        await tx.queryObject(
          `DELETE FROM pagos p
            WHERE p.id = ANY($1::bigint[])
              AND NOT EXISTS (SELECT 1 FROM pago_pensiones pp WHERE pp.pago_id = p.id)`,
          [paymentIds],
        );
      }

      // Una cuenta de estudiante puede haber sido creada para esta gestión. No
      // se borra la cuenta de usuario, pero sí el perfil académico si no tiene
      // ninguna otra inscripción, nota, asistencia, entrega o pago.
      if (studentIds.length) {
        await tx.queryObject(
          `DELETE FROM estudiantes e
            WHERE e.id = ANY($1::bigint[])
              AND NOT EXISTS (SELECT 1 FROM inscripciones i WHERE i.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM solicitudes_inscripcion s WHERE s.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM calificaciones c WHERE c.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM asistencia a WHERE a.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM encargo_entregas ee WHERE ee.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM pensiones p WHERE p.estudiante_id = e.id)
              AND NOT EXISTS (SELECT 1 FROM pagos p WHERE p.estudiante_id = e.id)`,
          [studentIds],
        );
      }

      await tx.queryObject(`DELETE FROM planes_pago WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM mallas_curriculares WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM trimestres WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM cursos_periodo WHERE periodo_id = $1::bigint`, [id]);
      await tx.queryObject(`DELETE FROM periodos_academicos WHERE id = $1::bigint`, [id]);

      return {
        id: String(id),
        nombre: period.rows[0].nombre,
        cursos: Number(row?.cursos ?? 0),
        inscripciones: Number(row?.inscripciones ?? 0),
        estudiantes: Number(row?.estudiantes ?? 0),
        pensiones: Number(row?.pensiones ?? 0),
        pagos: Number(row?.pagos ?? 0),
        horarios: Number(row?.horarios ?? 0),
        asignaciones: Number(row?.asignaciones ?? 0),
        materiales: Number(row?.materiales ?? 0),
        encargos: Number(row?.encargos ?? 0),
        notas: Number(row?.notas ?? 0),
        asistencia: Number(row?.asistencia ?? 0),
        planes: Number(row?.planes ?? 0),
      };
    });
  } catch (err) {
    throw mapDbError(err, "Error al eliminar la gestión académica y sus datos relacionados");
  }
}

export async function checkAndDeactivateExpiredPeriodos(): Promise<number> {
  try {
    const res = await query<{ count: string }>(
      `WITH expired AS (
         UPDATE periodos_academicos
         SET activo = false, estado = 'cerrado'
         WHERE activo = true AND fin_gestion < CURRENT_DATE
         RETURNING id
       )
       SELECT COUNT(*) AS count FROM expired`
    );
    const deactivated = Number(res.rows[0]?.count ?? 0);
    if (deactivated > 0) {
      console.log(`[periodos] Tarea programada: Se desactivaron ${deactivated} período(s) académico(s) cuya fecha fin expiró.`);
    }
    return deactivated;
  } catch (err) {
    console.error("[periodos] Error en verificación de periodos expirados:", err);
    return 0;
  }
}

