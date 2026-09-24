import { query } from "../connects/Database/transaction.ts";
import {
  CreateCursoInput,
  Curso,
  NIVELES,
  NivelEducativo,
  PaginatedResult,
  PaginationQuery,
  UpdateCursoInput,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { serialize, toId } from "../utils/serialize.ts";

interface CursoRow {
  id: bigint;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima: number;
  activo: boolean;
  caratulaUrl?: string | null;
}

function mapCurso(row: CursoRow): Curso {
  return serialize({
    id: toId(row.id),
    nivel: row.nivel,
    grado: row.grado,
    paralelo: row.paralelo,
    capacidadMaxima: Number(row.capacidadMaxima),
    activo: Boolean(row.activo),
    caratulaUrl: row.caratulaUrl ?? null,
  });
}

function parseNivel(value: unknown): NivelEducativo {
  const nivel = String(value ?? "").trim().toLowerCase() as NivelEducativo;
  if (!NIVELES.includes(nivel)) {
    throw new HttpError(400, `nivel debe ser uno de: ${NIVELES.join(", ")}`);
  }
  return nivel;
}

const SELECT = `
  SELECT
    id,
    nivel,
    grado,
    paralelo,
    capacidad_maxima AS "capacidadMaxima",
    activo,
    caratula_url AS "caratulaUrl"
  FROM cursos
`;

export async function listCursos(
  pagination: PaginationQuery,
  filters: { nivel?: string; activo?: string; buscar?: string },
): Promise<PaginatedResult<Curso>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.nivel) {
    const nivel = parseNivel(filters.nivel);
    conditions.push(`nivel = $${idx++}`);
    params.push(nivel);
  }
  if (filters.activo === "true" || filters.activo === "false") {
    conditions.push(`activo = $${idx++}`);
    params.push(filters.activo === "true");
  }
  if (filters.buscar) {
    conditions.push(`(grado ILIKE $${idx} OR paralelo ILIKE $${idx})`);
    params.push(`%${filters.buscar}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<CursoRow>(
        `${SELECT} ${where} ORDER BY nivel, grado, paralelo LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(`SELECT COUNT(*) AS total FROM cursos ${where}`, params),
    ]);
    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapCurso),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar cursos");
  }
}

export async function getCursoById(id: string): Promise<Curso> {
  const res = await query<CursoRow>(`${SELECT} WHERE id = $1`, [id]);
  if (res.rows.length === 0) throw new HttpError(404, `Curso id=${id} no encontrado`);
  return mapCurso(res.rows[0]);
}

export async function createCurso(input: CreateCursoInput): Promise<Curso> {
  const nivel = parseNivel(input.nivel);
  const grado = String(input.grado ?? "").trim();
  const paralelo = String(input.paralelo ?? "").trim();
  if (!grado) throw new HttpError(400, "grado es obligatorio");
  if (!paralelo) throw new HttpError(400, "paralelo es obligatorio");

  const capacidad = Number(input.capacidadMaxima ?? 30);
  if (!Number.isInteger(capacidad) || capacidad < 1) {
    throw new HttpError(400, "capacidadMaxima debe ser un entero mayor a 0");
  }

  try {
    const res = await query<CursoRow>(
      `INSERT INTO cursos (nivel, grado, paralelo, capacidad_maxima, activo, caratula_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nivel, grado, paralelo, capacidad_maxima AS "capacidadMaxima", activo, caratula_url AS "caratulaUrl"`,
      [nivel, grado, paralelo, capacidad, input.activo !== false, input.caratulaUrl ?? null],
    );
    return mapCurso(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear el curso");
  }
}

export async function updateCurso(id: string, input: UpdateCursoInput): Promise<Curso> {
  await getCursoById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.nivel !== undefined) {
    fields.push(`nivel = $${idx++}`);
    params.push(parseNivel(input.nivel));
  }
  if (input.grado !== undefined) {
    const grado = String(input.grado).trim();
    if (!grado) throw new HttpError(400, "grado no puede estar vacío");
    fields.push(`grado = $${idx++}`);
    params.push(grado);
  }
  if (input.paralelo !== undefined) {
    const paralelo = String(input.paralelo).trim();
    if (!paralelo) throw new HttpError(400, "paralelo no puede estar vacío");
    fields.push(`paralelo = $${idx++}`);
    params.push(paralelo);
  }
  if (input.capacidadMaxima !== undefined) {
    const capacidad = Number(input.capacidadMaxima);
    if (!Number.isInteger(capacidad) || capacidad < 1) {
      throw new HttpError(400, "capacidadMaxima debe ser un entero mayor a 0");
    }
    fields.push(`capacidad_maxima = $${idx++}`);
    params.push(capacidad);
  }
  if (input.activo !== undefined) {
    fields.push(`activo = $${idx++}`);
    params.push(Boolean(input.activo));
  }
  if (input.caratulaUrl !== undefined) {
    fields.push(`caratula_url = $${idx++}`);
    params.push(input.caratulaUrl ? String(input.caratulaUrl).trim() : null);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    const res = await query<CursoRow>(
      `UPDATE cursos SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING id, nivel, grado, paralelo, capacidad_maxima AS "capacidadMaxima", activo, caratula_url AS "caratulaUrl"`,
      params,
    );
    return mapCurso(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar el curso");
  }
}

export async function deleteCurso(id: string): Promise<void> {
  await getCursoById(id);
  try {
    await query(`DELETE FROM cursos WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar el curso");
  }
}
