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
  tipoMateria: "principal" | "extracurricular";
  cargaHorariaSemanal: number;
  pesoSintactico: number;
  materiaPesada: boolean;
  activo: boolean;
  caratulaUrl?: string | null;
  fechaCreacion: Date | string;
  fechaActualizacion: Date | string;
}

function mapMateria(row: MateriaRow): Materia {
  return serialize({
    id: toId(row.id),
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion,
    tipoMateria: row.tipoMateria,
    cargaHorariaSemanal: Number(row.cargaHorariaSemanal),
    pesoSintactico: Number(row.pesoSintactico),
    materiaPesada: Boolean(row.materiaPesada),
    activo: Boolean(row.activo),
    caratulaUrl: row.caratulaUrl ?? null,
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
    tipo_materia AS "tipoMateria",
    carga_horaria_semanal AS "cargaHorariaSemanal",
    peso_sintactico AS "pesoSintactico",
    materia_pesada AS "materiaPesada",
    activo,
    caratula_url AS "caratulaUrl",
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
  const tipoMateria = input.tipoMateria ?? "principal";
  const materiaPesada = input.materiaPesada ?? /matem[aá]tica|f[ií]sica|qu[ií]mica/i.test(nombre);
  const carga = Number(input.cargaHorariaSemanal ?? 5);
  const peso = Number(input.pesoSintactico ?? (tipoMateria === "extracurricular" ? 1 : 3));
  if (tipoMateria !== "principal" && tipoMateria !== "extracurricular") throw new HttpError(400, "tipoMateria inválido");
  if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "cargaHorariaSemanal debe estar entre 1 y 40");
  if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "pesoSintactico debe estar entre 1 y 100");
  if (tipoMateria === "extracurricular" && peso >= 3) throw new HttpError(400, "Las extracurriculares deben tener menor peso sintáctico");

  try {
    const res = await query<MateriaRow>(
      `INSERT INTO materias
         (codigo, nombre, descripcion, tipo_materia, carga_horaria_semanal, peso_sintactico, materia_pesada, activo, caratula_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id, codigo, nombre, descripcion,
         tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
         peso_sintactico AS "pesoSintactico", materia_pesada AS "materiaPesada", activo,
         caratula_url AS "caratulaUrl",
         fecha_creacion AS "fechaCreacion", fecha_actualizacion AS "fechaActualizacion"`,
      [codigo, nombre, input.descripcion ?? null, tipoMateria, carga, peso, materiaPesada, input.activo !== false, input.caratulaUrl ?? null],
    );
    return mapMateria(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear la materia");
  }
}

export async function updateMateria(id: string, input: UpdateMateriaInput): Promise<Materia> {
  const current = await getMateriaById(id);
  const affectsSchedule = ["nombre", "tipoMateria", "cargaHorariaSemanal", "pesoSintactico", "materiaPesada", "activo"]
    .some((field) => input[field as keyof UpdateMateriaInput] !== undefined);
  if (affectsSchedule) {
    const inActive = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM mallas_curriculares mc
         JOIN periodos_academicos p ON p.id = mc.periodo_id
         WHERE mc.materia_id = $1 AND p.activo = true
       ) AS exists`,
      [id],
    );
    if (inActive.rows[0]?.exists) {
      throw new HttpError(409, "La materia está en uso por una gestión activa y no puede cambiar sus parámetros de planificación");
    }
  }
  const effectiveTipo = input.tipoMateria ?? current.tipoMateria;
  const effectivePeso = input.pesoSintactico !== undefined
    ? Number(input.pesoSintactico)
    : effectiveTipo === "extracurricular" ? 1 : current.pesoSintactico;
  if (effectiveTipo === "extracurricular" && effectivePeso >= 3) {
    throw new HttpError(400, "Las extracurriculares deben tener menor peso sintáctico");
  }
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
  if (input.tipoMateria !== undefined) {
    if (input.tipoMateria !== "principal" && input.tipoMateria !== "extracurricular") throw new HttpError(400, "tipoMateria inválido");
    fields.push(`tipo_materia = $${idx++}`);
    params.push(input.tipoMateria);
  }
  if (input.cargaHorariaSemanal !== undefined) {
    const carga = Number(input.cargaHorariaSemanal);
    if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "cargaHorariaSemanal debe estar entre 1 y 40");
    fields.push(`carga_horaria_semanal = $${idx++}`);
    params.push(carga);
  }
  if (input.pesoSintactico !== undefined) {
    const peso = Number(input.pesoSintactico);
    if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "pesoSintactico debe estar entre 1 y 100");
    fields.push(`peso_sintactico = $${idx++}`);
    params.push(peso);
  }
  if (input.materiaPesada !== undefined) {
    fields.push(`materia_pesada = $${idx++}`);
    params.push(Boolean(input.materiaPesada));
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
  fields.push(`fecha_actualizacion = NOW()`);

  try {
    params.push(id);
    const res = await query<MateriaRow>(
      `UPDATE materias SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING
         id, codigo, nombre, descripcion,
         tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
         peso_sintactico AS "pesoSintactico", materia_pesada AS "materiaPesada", activo,
         caratula_url AS "caratulaUrl",
         fecha_creacion AS "fechaCreacion", fecha_actualizacion AS "fechaActualizacion"`,
      params,
    );
    if (affectsSchedule) {
      await query(
        `UPDATE periodos_academicos p
         SET horarios_generados = false
         WHERE p.activo = false
           AND EXISTS (
             SELECT 1 FROM mallas_curriculares mc WHERE mc.periodo_id = p.id AND mc.materia_id = $1
           )`,
        [id],
      );
    }
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
