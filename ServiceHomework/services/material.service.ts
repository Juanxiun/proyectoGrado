import { query, sTransaction } from "../connects/Database/transaction.ts";
import { deleteMaterialFile, resolveFileUrl } from "../connects/Storage/minio.ts";
import {
  CreateMateriaMaterialInput,
  MateriaMaterial,
  PaginatedResult,
  PaginationQuery,
  UpdateMateriaMaterialInput,
} from "../models/homework.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";

interface MaterialRow {
  id: bigint;
  asignacionId: bigint;
  titulo: string;
  detalle?: string | null;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: bigint | number | null;
  fechaSubida: Date | string;
  activo: boolean;
  // Asignacion info
  maestroId?: bigint;
  materiaId?: bigint;
  cursoPeriodoId?: bigint;
  materiaNombre?: string;
  materiaCodigo?: string;
}

async function mapMaterial(row: MaterialRow): Promise<MateriaMaterial> {
  const resolvedUrl = (await resolveFileUrl(row.archivoUrl)) ?? row.archivoUrl;
  return serialize({
    id: toId(row.id),
    asignacionId: toId(row.asignacionId),
    titulo: row.titulo,
    detalle: row.detalle,
    archivoUrl: resolvedUrl,
    nombreArchivo: row.nombreArchivo,
    tipoMime: row.tipoMime,
    tamanioBytes: row.tamanioBytes ? Number(row.tamanioBytes) : null,
    fechaSubida: asDateTimeString(row.fechaSubida),
    activo: Boolean(row.activo),
    asignacion: row.materiaId
      ? {
        id: toId(row.asignacionId),
        maestroId: toId(row.maestroId),
        materiaId: toId(row.materiaId),
        cursoPeriodoId: toId(row.cursoPeriodoId),
        materiaNombre: row.materiaNombre,
        materiaCodigo: row.materiaCodigo,
      }
      : null,
  });
}

const SELECT = `
  SELECT
    mm.id,
    mm.asignacion_id AS "asignacionId",
    mm.titulo,
    mm.detalle,
    mm.archivo_url AS "archivoUrl",
    mm.nombre_archivo AS "nombreArchivo",
    mm.tipo_mime AS "tipoMime",
    mm.tamanio_bytes AS "tamanioBytes",
    mm.fecha_subida AS "fechaSubida",
    mm.activo,
    ad.maestro_id AS "maestroId",
    ad.materia_id AS "materiaId",
    ad.curso_periodo_id AS "cursoPeriodoId",
    m.nombre AS "materiaNombre",
    m.codigo AS "materiaCodigo"
  FROM materia_materiales mm
  JOIN asignaciones_docentes ad ON ad.id = mm.asignacion_id
  JOIN materias m ON m.id = ad.materia_id
`;

export async function listMateriales(
  pagination: PaginationQuery,
  filters: { asignacionId?: string; activo?: boolean; buscar?: string },
): Promise<PaginatedResult<MateriaMaterial>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.asignacionId) {
    if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId debe ser numérico");
    conditions.push(`mm.asignacion_id = $${idx++}`);
    params.push(filters.asignacionId);
  }
  if (filters.activo !== undefined) {
    conditions.push(`mm.activo = $${idx++}`);
    params.push(filters.activo);
  }
  if (filters.buscar) {
    conditions.push(`(mm.titulo ILIKE $${idx} OR mm.detalle ILIKE $${idx} OR mm.nombre_archivo ILIKE $${idx})`);
    params.push(`%${filters.buscar}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<MaterialRow>(
        `${SELECT} ${where} ORDER BY mm.fecha_subida DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM materia_materiales mm ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const data = await Promise.all(dataRes.rows.map(mapMaterial));
    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar materiales");
  }
}

export async function getMaterialById(id: string): Promise<MateriaMaterial> {
  const res = await query<MaterialRow>(`${SELECT} WHERE mm.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Material id=${id} no encontrado`);
  }
  return await mapMaterial(res.rows[0]);
}

export async function createMaterial(input: CreateMateriaMaterialInput): Promise<MateriaMaterial> {
  const asigId = String(input.asignacionId ?? "").trim();
  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!input.titulo?.trim()) throw new HttpError(400, "titulo es obligatorio");
  if (!input.archivoUrl?.trim()) throw new HttpError(400, "archivoUrl es obligatorio");

  const asigRes = await query<{ id: bigint }>(
    `SELECT id FROM asignaciones_docentes WHERE id = $1`,
    [asigId],
  );
  if (asigRes.rows.length === 0) {
    throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);
  }

  try {
    const res = await query<{ id: bigint }>(
      `INSERT INTO materia_materiales (
        asignacion_id, titulo, detalle, archivo_url, nombre_archivo, tipo_mime, tamanio_bytes, activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        asigId,
        input.titulo.trim(),
        input.detalle?.trim() ?? null,
        input.archivoUrl.trim(),
        input.nombreArchivo?.trim() ?? null,
        input.tipoMime?.trim() ?? null,
        input.tamanioBytes ?? null,
        input.activo ?? true,
      ],
    );
    return await getMaterialById(toId(res.rows[0].id));
  } catch (err) {
    throw mapDbError(err, "Error al registrar material");
  }
}

export async function updateMaterial(id: string, input: UpdateMateriaMaterialInput): Promise<MateriaMaterial> {
  await getMaterialById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.titulo !== undefined) {
    if (!input.titulo.trim()) throw new HttpError(400, "titulo no puede estar vacío");
    fields.push(`titulo = $${idx++}`);
    params.push(input.titulo.trim());
  }
  if (input.detalle !== undefined) {
    fields.push(`detalle = $${idx++}`);
    params.push(input.detalle?.trim() ?? null);
  }
  if (input.archivoUrl !== undefined) {
    if (!input.archivoUrl.trim()) throw new HttpError(400, "archivoUrl no puede estar vacío");
    fields.push(`archivo_url = $${idx++}`);
    params.push(input.archivoUrl.trim());
  }
  if (input.nombreArchivo !== undefined) {
    fields.push(`nombre_archivo = $${idx++}`);
    params.push(input.nombreArchivo?.trim() ?? null);
  }
  if (input.tipoMime !== undefined) {
    fields.push(`tipo_mime = $${idx++}`);
    params.push(input.tipoMime?.trim() ?? null);
  }
  if (input.tamanioBytes !== undefined) {
    fields.push(`tamanio_bytes = $${idx++}`);
    params.push(input.tamanioBytes ?? null);
  }
  if (input.activo !== undefined) {
    fields.push(`activo = $${idx++}`);
    params.push(input.activo);
  }

  if (fields.length === 0) throw new HttpError(400, "No hay campos para actualizar");

  try {
    params.push(id);
    await query(`UPDATE materia_materiales SET ${fields.join(", ")} WHERE id = $${idx}`, params);
    return await getMaterialById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar material");
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  const current = await getMaterialById(id);
  try {
    await sTransaction(async (client) => {
      // Remover relaciones de encargo_materiales
      await client.queryObject(`DELETE FROM encargo_materiales WHERE material_id = $1`, [id]);
      await client.queryObject(`DELETE FROM materia_materiales WHERE id = $1`, [id]);
    });
    // Eliminar archivo físico de MinIO
    if (current.archivoUrl) {
      await deleteMaterialFile(current.archivoUrl);
    }
  } catch (err) {
    throw mapDbError(err, "Error al eliminar material");
  }
}
