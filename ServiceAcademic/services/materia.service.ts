import { query } from "../connects/Database/transaction.ts";
import {
  CreateMateriaInput,
  Materia,
  PaginatedResult,
  PaginationQuery,
  UpdateMateriaInput,
} from "../models/academic.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface MateriaRow {
  id: bigint;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: Date | string;
  fechaActualizacion: Date | string;
}

function mapMateria(row: MateriaRow): Materia {
  return serialize({
    id: toId(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    activo: Boolean(row.activo),
    fechaCreacion: asDateTimeString(row.fechaCreacion),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
  });
}

const SELECT = `
  SELECT
    id,
    codigo,
    nombre,
    descripcion,
    activo,
    fecha_creacion AS "fechaCreacion",
    fecha_actualizacion AS "fechaActualizacion"
  FROM materias
`;

export async function listMaterias(
  pagination: PaginationQuery,
  filters: { activo?: string; buscar?: string },
): Promise<PaginatedResult<Materia>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.activo === "true" || filters.activo === "false") {
    conditions.push(`activo = $${idx++}`);
    params.push(filters.activo === "true");
  }
  if (filters.buscar) {
    conditions.push(`(codigo ILIKE $${idx} OR nombre ILIKE $${idx})`);
    params.push(`%${filters.buscar}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<MateriaRow>(
        `${SELECT} ${where} ORDER BY nombre ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(`SELECT COUNT(*) AS total FROM materias ${where}`, params),
    ]);
    const total = Number(countRes.rows[0]?.total ?? 0);
    return {
      data: dataRes.rows.map(mapMateria),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar materias");
  }
}

export async function getMateriaById(id: string): Promise<Materia> {
  const res = await query<MateriaRow>(`${SELECT} WHERE id = $1`, [id]);
  if (res.rows.length === 0) throw new HttpError(404, `Materia id=${id} no encontrada`);
  return mapMateria(res.rows[0]);
}

export async function createMateria(input: CreateMateriaInput): Promise<Materia> {
  const codigo = String(input.codigo ?? "").trim().toUpperCase();
  const nombre = String(input.nombre ?? "").trim();
  if (!codigo) throw new HttpError(400, "codigo es obligatorio");
  if (!nombre) throw new HttpError(400, "nombre es obligatorio");

  try {
    const res = await query<MateriaRow>(
      `INSERT INTO materias (codigo, nombre, descripcion, activo)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id, codigo, nombre, descripcion, activo,
         fecha_creacion AS "fechaCreacion",
         fecha_actualizacion AS "fechaActualizacion"`,
      [codigo, nombre, input.descripcion ?? null, input.activo !== false],
    );
    return mapMateria(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear la materia");
  }
}

export async function updateMateria(id: string, input: UpdateMateriaInput): Promise<Materia> {
  await getMateriaById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.codigo !== undefined) {
    const codigo = String(input.codigo).trim().toUpperCase();
    if (!codigo) throw new HttpError(400, "codigo no puede estar vacío");
    fields.push(`codigo = $${idx++}`);
    params.push(codigo);
  }
  if (input.nombre !== undefined) {
    const nombre = String(input.nombre).trim();
    if (!nombre) throw new HttpError(400, "nombre no puede estar vacío");
    fields.push(`nombre = $${idx++}`);
    params.push(nombre);
  }
  if (input.descripcion !== undefined) {
    fields.push(`descripcion = $${idx++}`);
    params.push(input.descripcion);
  }
  if (input.activo !== undefined) {
    fields.push(`activo = $${idx++}`);
    params.push(Boolean(input.activo));
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");
  fields.push(`fecha_actualizacion = NOW()`);

  try {
    params.push(id);
    const res = await query<MateriaRow>(
      `UPDATE materias SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING
         id, codigo, nombre, descripcion, activo,
         fecha_creacion AS "fechaCreacion",
         fecha_actualizacion AS "fechaActualizacion"`,
      params,
    );
    return mapMateria(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar la materia");
  }
}

export async function deleteMateria(id: string): Promise<void> {
  await getMateriaById(id);
  try {
    await query(`DELETE FROM materias WHERE id = $1`, [id]);
  } catch (err) {
    throw mapDbError(err, "Error al eliminar la materia");
  }
}
