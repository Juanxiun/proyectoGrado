import { query, sTransaction } from "../connects/Database/transaction.ts";
import {
  CreateEncargoInput,
  Encargo,
  ESTADOS_ENCARGO,
  MateriaMaterial,
  PaginatedResult,
  PaginationQuery,
  UpdateEncargoInput,
} from "../models/homework.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { isIsoDateTime } from "../utils/http.ts";
import { resolveFileUrl } from "../connects/Storage/minio.ts";

interface EncargoRow {
  id: bigint;
  asignacionId: bigint;
  tipo: string;
  titulo: string;
  descripcion?: string | null;
  ponderacion: string | number;
  fechaPublicacion?: Date | string | null;
  fechaLimite?: Date | string | null;
  estado: string;
  fechaCreacion: Date | string;
  fechaActualizacion: Date | string;
  // Asignacion info
  maestroId?: bigint;
  materiaId?: bigint;
  cursoPeriodoId?: bigint;
  materiaNombre?: string;
}

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
}

function mapEncargo(row: EncargoRow, materiales: MateriaMaterial[] = []): Encargo {
  return serialize({
    id: toId(row.id),
    asignacionId: toId(row.asignacionId),
    tipo: row.tipo,
    titulo: row.titulo,
    descripcion: row.descripcion,
    ponderacion: Number(row.ponderacion),
    fechaPublicacion: row.fechaPublicacion ? asDateTimeString(row.fechaPublicacion) : null,
    fechaLimite: row.fechaLimite ? asDateTimeString(row.fechaLimite) : null,
    estado: row.estado as any,
    fechaCreacion: asDateTimeString(row.fechaCreacion),
    fechaActualizacion: asDateTimeString(row.fechaActualizacion),
    materiales,
    asignacion: row.materiaId
      ? {
        id: toId(row.asignacionId),
        maestroId: toId(row.maestroId),
        materiaId: toId(row.materiaId),
        cursoPeriodoId: toId(row.cursoPeriodoId),
        materiaNombre: row.materiaNombre,
      }
      : null,
  });
}

const SELECT = `
  SELECT
    e.id,
    e.asignacion_id AS "asignacionId",
    e.tipo,
    e.titulo,
    e.descripcion,
    e.ponderacion,
    e.fecha_publicacion AS "fechaPublicacion",
    e.fecha_limite AS "fechaLimite",
    e.estado,
    e.fecha_creacion AS "fechaCreacion",
    e.fecha_actualizacion AS "fechaActualizacion",
    ad.maestro_id AS "maestroId",
    ad.materia_id AS "materiaId",
    ad.curso_periodo_id AS "cursoPeriodoId",
    m.nombre AS "materiaNombre"
  FROM encargos e
  JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
  JOIN materias m ON m.id = ad.materia_id
`;

async function getMaterialesForEncargos(encargoIds: string[]): Promise<Record<string, MateriaMaterial[]>> {
  if (encargoIds.length === 0) return {};
  const res = await query<MaterialRow & { encargoId: bigint }>(
    `SELECT
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
      em.encargo_id AS "encargoId"
     FROM encargo_materiales em
     JOIN materia_materiales mm ON mm.id = em.material_id
     WHERE em.encargo_id = ANY($1::bigint[])`,
    [encargoIds],
  );

  const map: Record<string, MateriaMaterial[]> = {};
  for (const r of res.rows) {
    const eId = toId(r.encargoId);
    if (!map[eId]) map[eId] = [];
    const resolvedUrl = (await resolveFileUrl(r.archivoUrl)) ?? r.archivoUrl;
    map[eId].push(
      serialize({
        id: toId(r.id),
        asignacionId: toId(r.asignacionId),
        titulo: r.titulo,
        detalle: r.detalle,
        archivoUrl: resolvedUrl,
        nombreArchivo: r.nombreArchivo,
        tipoMime: r.tipoMime,
        tamanioBytes: r.tamanioBytes ? Number(r.tamanioBytes) : null,
        fechaSubida: asDateTimeString(r.fechaSubida),
        activo: Boolean(r.activo),
      }),
    );
  }
  return map;
}

export async function listEncargos(
  pagination: PaginationQuery,
  filters: { asignacionId?: string; tipo?: string; estado?: string; buscar?: string },
): Promise<PaginatedResult<Encargo>> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.asignacionId) {
    if (!/^\d+$/.test(filters.asignacionId)) throw new HttpError(400, "asignacionId debe ser numérico");
    conditions.push(`e.asignacion_id = $${idx++}`);
    params.push(filters.asignacionId);
  }
  if (filters.tipo) {
    conditions.push(`e.tipo = $${idx++}`);
    params.push(filters.tipo);
  }
  if (filters.estado) {
    conditions.push(`e.estado = $${idx++}`);
    params.push(filters.estado);
  }
  if (filters.buscar) {
    conditions.push(`(e.titulo ILIKE $${idx} OR e.descripcion ILIKE $${idx})`);
    params.push(`%${filters.buscar}%`);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [dataRes, countRes] = await Promise.all([
      query<EncargoRow>(
        `${SELECT} ${where} ORDER BY e.fecha_creacion DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, pagination.limit, pagination.offset],
      ),
      query<{ total: string }>(
        `SELECT COUNT(*) AS total FROM encargos e ${where}`,
        params,
      ),
    ]);

    const total = Number(countRes.rows[0]?.total ?? 0);
    const encargoIds = dataRes.rows.map((r: EncargoRow) => toId(r.id));
    const materialesMap = await getMaterialesForEncargos(encargoIds);

    const data = dataRes.rows.map((r: EncargoRow) => mapEncargo(r, materialesMap[toId(r.id)] ?? []));

    return {
      data,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 0,
    };
  } catch (err) {
    throw mapDbError(err, "Error al listar encargos");
  }
}

export async function getEncargoById(id: string): Promise<Encargo> {
  const res = await query<EncargoRow>(`${SELECT} WHERE e.id = $1`, [id]);
  if (res.rows.length === 0) {
    throw new HttpError(404, `Encargo id=${id} no encontrado`);
  }
  const materialesMap = await getMaterialesForEncargos([id]);
  return mapEncargo(res.rows[0], materialesMap[id] ?? []);
}

export async function createEncargo(input: CreateEncargoInput): Promise<Encargo> {
  let asigId = String(input.asignacionId ?? "").trim();
  if (!asigId && (input as any).cursoPeriodoId && (input as any).materiaId) {
    const cpId = String((input as any).cursoPeriodoId).trim();
    const mId = String((input as any).materiaId).trim();
    const found = await query<{ id: bigint }>(
      `SELECT id FROM asignaciones_docentes WHERE curso_periodo_id = $1 AND materia_id = $2 LIMIT 1`,
      [cpId, mId],
    );
    if (found.rows.length > 0) {
      asigId = toId(found.rows[0].id);
    }
  }

  if (!asigId) throw new HttpError(400, "asignacionId es obligatorio para asignar la tarea al curso");
  if (!/^\d+$/.test(asigId)) throw new HttpError(400, "asignacionId debe ser numérico");
  if (!input.titulo?.trim()) throw new HttpError(400, "titulo es obligatorio");
  if (!input.tipo?.trim()) throw new HttpError(400, "tipo es obligatorio (ej: tarea, examen, proyecto)");

  const ponderacion = Number(input.ponderacion);
  if (isNaN(ponderacion) || ponderacion <= 0 || ponderacion > 100) {
    throw new HttpError(400, "ponderacion debe ser un número mayor a 0 y menor o igual a 100");
  }

  const estado = input.estado ?? "borrador";
  if (!ESTADOS_ENCARGO.includes(estado)) {
    throw new HttpError(400, `estado inválido. Opciones: ${ESTADOS_ENCARGO.join(", ")}`);
  }

  if (input.fechaPublicacion && !isIsoDateTime(input.fechaPublicacion)) {
    throw new HttpError(400, "fechaPublicacion debe tener formato de fecha/hora válido");
  }
  if (input.fechaLimite && !isIsoDateTime(input.fechaLimite)) {
    throw new HttpError(400, "fechaLimite debe tener formato de fecha/hora válido");
  }
  if (input.fechaPublicacion && input.fechaLimite) {
    if (new Date(input.fechaLimite).getTime() < new Date(input.fechaPublicacion).getTime()) {
      throw new HttpError(400, "La fecha límite no puede ser anterior a la fecha de publicación");
    }
  }

  const asigRes = await query<{ id: bigint }>(
    `SELECT id FROM asignaciones_docentes WHERE id = $1`,
    [asigId],
  );
  if (asigRes.rows.length === 0) {
    throw new HttpError(404, `Asignación docente id=${asigId} no encontrada`);
  }

  try {
    const encargoId = await sTransaction(async (client) => {
      const insRes = await client.queryObject<{ id: bigint }>(
        `INSERT INTO encargos (
          asignacion_id, tipo, titulo, descripcion, ponderacion, fecha_publicacion, fecha_limite, estado
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          asigId,
          input.tipo.trim(),
          input.titulo.trim(),
          input.descripcion?.trim() ?? null,
          ponderacion,
          input.fechaPublicacion ?? null,
          input.fechaLimite ?? null,
          estado,
        ],
      );

      const id = toId(insRes.rows[0].id);

      if (input.materialIds && input.materialIds.length > 0) {
        for (const matId of input.materialIds) {
          const mId = String(matId).trim();
          if (/^\d+$/.test(mId)) {
            await client.queryObject(
              `INSERT INTO encargo_materiales (encargo_id, material_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [id, mId],
            );
          }
        }
      }

      return id;
    });

    return await getEncargoById(encargoId);
  } catch (err) {
    throw mapDbError(err, "Error al crear encargo");
  }
}

export async function updateEncargo(id: string, input: UpdateEncargoInput): Promise<Encargo> {
  await getEncargoById(id);
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (input.tipo !== undefined) {
    if (!input.tipo.trim()) throw new HttpError(400, "tipo no puede estar vacío");
    fields.push(`tipo = $${idx++}`);
    params.push(input.tipo.trim());
  }
  if (input.titulo !== undefined) {
    if (!input.titulo.trim()) throw new HttpError(400, "titulo no puede estar vacío");
    fields.push(`titulo = $${idx++}`);
    params.push(input.titulo.trim());
  }
  if (input.descripcion !== undefined) {
    fields.push(`descripcion = $${idx++}`);
    params.push(input.descripcion?.trim() ?? null);
  }
  if (input.ponderacion !== undefined) {
    const pond = Number(input.ponderacion);
    if (isNaN(pond) || pond <= 0 || pond > 100) {
      throw new HttpError(400, "ponderacion debe ser un número entre 0 y 100");
    }
    fields.push(`ponderacion = $${idx++}`);
    params.push(pond);
  }
  if (input.fechaPublicacion !== undefined) {
    if (input.fechaPublicacion && !isIsoDateTime(input.fechaPublicacion)) {
      throw new HttpError(400, "fechaPublicacion inválida");
    }
    fields.push(`fecha_publicacion = $${idx++}`);
    params.push(input.fechaPublicacion ?? null);
  }
  if (input.fechaLimite !== undefined) {
    if (input.fechaLimite && !isIsoDateTime(input.fechaLimite)) {
      throw new HttpError(400, "fechaLimite inválida");
    }
    fields.push(`fecha_limite = $${idx++}`);
    params.push(input.fechaLimite ?? null);
  }
  if (input.estado !== undefined) {
    if (!ESTADOS_ENCARGO.includes(input.estado)) {
      throw new HttpError(400, `estado inválido. Opciones: ${ESTADOS_ENCARGO.join(", ")}`);
    }
    fields.push(`estado = $${idx++}`);
    params.push(input.estado);
  }

  fields.push(`fecha_actualizacion = CURRENT_TIMESTAMP`);

  try {
    await sTransaction(async (client) => {
      params.push(id);
      await client.queryObject(`UPDATE encargos SET ${fields.join(", ")} WHERE id = $${idx}`, params);

      if (input.materialIds !== undefined) {
        await client.queryObject(`DELETE FROM encargo_materiales WHERE encargo_id = $1`, [id]);
        for (const matId of input.materialIds) {
          const mId = String(matId).trim();
          if (/^\d+$/.test(mId)) {
            await client.queryObject(
              `INSERT INTO encargo_materiales (encargo_id, material_id)
               VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [id, mId],
            );
          }
        }
      }
    });

    return await getEncargoById(id);
  } catch (err) {
    throw mapDbError(err, "Error al actualizar encargo");
  }
}

export async function deleteEncargo(id: string): Promise<void> {
  await getEncargoById(id);
  try {
    await sTransaction(async (client) => {
      await client.queryObject(`DELETE FROM encargo_materiales WHERE encargo_id = $1`, [id]);
      await client.queryObject(`DELETE FROM encargo_entregas WHERE encargo_id = $1`, [id]);
      await client.queryObject(`DELETE FROM calificaciones WHERE encargo_id = $1`, [id]);
      await client.queryObject(`DELETE FROM encargos WHERE id = $1`, [id]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al eliminar encargo");
  }
}
