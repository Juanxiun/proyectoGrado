import { query } from "../connects/Database/transaction.ts";
import {
  CreateCursoAsesorInput,
  CursoAsesor,
  PaginatedResult,
  PaginationQuery,
  UpdateCursoAsesorInput,
} from "../models/enrollment.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateString, serialize, toId } from "../utils/serialize.ts";
import { isIsoDate } from "../utils/http.ts";

interface AsesorRow {
  id: bigint;
  cursoPeriodoId: bigint;
  maestroId: bigint;
  fechaInicio: Date | string;
  fechaFin: Date | string | null;
  // Maestro info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  // Curso Periodo info
  cursoId?: bigint;
  periodoId?: bigint;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  anio?: number;
  periodoNombre?: string;
}

function mapAsesor(row: AsesorRow): CursoAsesor {
  return serialize({
    id: toId(row.id),
    cursoPeriodoId: toId(row.cursoPeriodoId),
    maestroId: toId(row.maestroId),
    fechaInicio: asDateString(row.fechaInicio),
    fechaFin: row.fechaFin ? asDateString(row.fechaFin) : null,
    maestro: row.usuarioId
      ? {
        id: toId(row.maestroId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
      }
      : null,
    cursoPeriodo: row.cursoId
      ? {
        id: toId(row.cursoPeriodoId),
        cursoId: toId(row.cursoId),
        periodoId: toId(row.periodoId!),
        capacidadMaxima: 0,
        estado: "activo",
        curso: {
          id: toId(row.cursoId),
          nivel: row.nivel ?? "",
          grado: row.grado ?? "",
          paralelo: row.paralelo ?? "",
          capacidadMaxima: 0,
          activo: true,
        },
        periodo: {
          id: toId(row.periodoId!),
          anio: Number(row.anio ?? 0),
          nombre: row.periodoNombre ?? "",
          fechaInicio: "",
          fechaFin: "",
          activo: true,
        },
      }
      : null,
  });
}

async function resolveMaestroId(input: string): Promise<string> {
  const res = await query<{ id: bigint }>(
    `SELECT id FROM maestros WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
    [input],
  );
  if (res.rows.length === 0) {
    throw new HttpError(404, `Maestro id=${input} no encontrado`);
  }
  return toId(res.rows[0].id);
}

const SELECT = `
  SELECT
    ca.id,
    ca.curso_periodo_id AS "cursoPeriodoId",
    ca.maestro_id AS "maestroId",
    ca.fecha_inicio AS "fechaInicio",
    ca.fecha_fin AS "fechaFin",
    m.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    cp.curso_id AS "cursoId",
    cp.periodo_id AS "periodoId",
    c.nivel,
    c.grado,
    c.paralelo,
    p.anio,
    p.nombre AS "periodoNombre"
  FROM curso_asesor ca
  JOIN maestros m ON m.id = ca.maestro_id
  JOIN usuarios u ON u.id = m.usuario_id
  JOIN cursos_periodo cp ON cp.id = ca.curso_periodo_id
  JOIN cursos c ON c.id = cp.curso_id
  JOIN periodos_academicos p ON p.id = cp.periodo_id
`;

export async function listAsesores(
  pagination: PaginationQuery,
  filters: { cursoPeriodoId?: string; maestroId?: string; periodoId?: string },
): Promise<PaginatedResult<CursoAsesor>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.cursoPeriodoId) {
    if (!/^\d+$/.test(filters.cursoPeriodoId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
    conditions.push(`ca.curso_periodo_id = $${idx++}`);
    params.push(filters.cursoPeriodoId);
  }
  if (filters.maestroId) {
    if (!/^\d+$/.test(filters.maestroId)) throw new HttpError(400, "maestroId debe ser numérico");
    conditions.push(`(ca.maestro_id = $${idx} OR m.usuario_id = $${idx})`);
    params.push(filters.maestroId);
    idx++;
  }
  if (filters.periodoId) {
    if (!/^\d+$/.test(filters.periodoId)) throw new HttpError(400, "periodoId debe ser numérico");
    conditions.push(`cp.periodo_id = $${idx++}`);
    params.push(filters.periodoId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<AsesorRow>(
        `${SELECT} ${where} ORDER BY p.anio DESC, c.nivel, c.grado, c.paralelo LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total
         FROM curso_asesor ca
         JOIN maestros m ON m.id = ca.maestro_id
         JOIN cursos_periodo cp ON cp.id = ca.curso_periodo_id
         ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapAsesor),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar asesores de curso");
  }
}

export async function getAsesorById(id: string): Promise<CursoAsesor> {
  const res = await query<AsesorRow>(`${SELECT} WHERE ca.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Asignación de asesor id=${id} no encontrada`);
  }
  return mapAsesor(res.rows[0]);
}

export async function createAsesor(input: CreateCursoAsesorInput): Promise<CursoAsesor> {
  const cpId = String(input.cursoPeriodoId ?? "").trim();
  const maestroInput = String(input.maestroId ?? "").trim();
  if (!/^\d+$/.test(cpId)) throw new HttpError(400, "cursoPeriodoId debe ser numérico");
  if (!/^\d+$/.test(maestroInput)) throw new HttpError(400, "maestroId debe ser numérico");

  if (!input.fechaInicio || !isIsoDate(input.fechaInicio)) {
    throw new HttpError(400, "fechaInicio es obligatoria (formato YYYY-MM-DD)");
  }
  if (input.fechaFin && !isIsoDate(input.fechaFin)) {
    throw new HttpError(400, "fechaFin debe tener formato YYYY-MM-DD");
  }

  const maestroId = await resolveMaestroId(maestroInput);

  const cpRes = await query<{ id: bigint; estado: string }>(
    `SELECT id, estado FROM cursos_periodo WHERE id = $1`,
    [cpId],
  );
  if (cpRes.rows.length === 0) throw new HttpError(404, `Curso-Periodo id=${cpId} no encontrado`);

  // Verificar si ya cuenta con asesor asignado
  const existingRes = await query<{ id: bigint }>(
    `SELECT id FROM curso_asesor WHERE curso_periodo_id = $1`,
    [cpId],
  );
  if (existingRes.rows.length > 0) {
    throw new HttpError(409, "El curso seleccionado ya cuenta con un maestro asesor asignado");
  }

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO curso_asesor (curso_periodo_id, maestro_id, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [cpId, maestroId, input.fechaInicio, input.fechaFin ?? null],
    );
    return await getAsesorById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al asignar asesor de curso");
  }
}

export async function updateAsesor(id: string, input: UpdateCursoAsesorInput): Promise<CursoAsesor> {
  await getAsesorById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.maestroId !== undefined) {
    const maestroId = await resolveMaestroId(String(input.maestroId));
    fields.push(`maestro_id = $${idx++}`);
    params.push(maestroId);
  }
  if (input.fechaInicio !== undefined) {
    if (!isIsoDate(input.fechaInicio)) throw new HttpError(400, "fechaInicio debe tener formato YYYY-MM-DD");
    fields.push(`fecha_inicio = $${idx++}`);
    params.push(input.fechaInicio);
  }
  if (input.fechaFin !== undefined) {
    if (input.fechaFin && !isIsoDate(input.fechaFin)) {
      throw new HttpError(400, "fechaFin debe tener formato YYYY-MM-DD");
    }
    fields.push(`fecha_fin = $${idx++}`);
    params.push(input.fechaFin ?? null);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    await query(`UPDATE curso_asesor SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getAsesorById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar asignación de asesor");
  }
}

export async function deleteAsesor(id: string): Promise<void> {
  await getAsesorById(id);
  try {
    await query(`DELETE FROM curso_asesor WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al remover asignación de asesor");
  }
}
