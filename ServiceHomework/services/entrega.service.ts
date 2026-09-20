import { query } from "../connects/Database/transaction.ts";
import {
  CreateEncargoEntregaInput,
  EncargoEntrega,
  PaginatedResult,
  PaginationQuery,
} from "../models/homework.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { resolveFileUrl } from "../connects/Storage/minio.ts";
import { AuthClaims } from "../security/auth.ts";

interface EntregaRow {
  id: bigint;
  encargoId: bigint;
  estudianteId: bigint;
  archivoUrl: string;
  nombreArchivo?: string | null;
  tipoMime?: string | null;
  tamanioBytes?: bigint | number | null;
  comentario?: string | null;
  fechaEntrega: Date | string;
  estadoEntrega: string;
  // Estudiante info
  usuarioId?: bigint;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  // Encargo info
  encargoTitulo?: string;
  encargoTipo?: string;
  encargoFechaLimite?: Date | string | null;
  asignacionId?: bigint;
  materiaNombre?: string;
}

function mapEntrega(row: EntregaRow): EncargoEntrega {
  return serialize({
    id: toId(row.id),
    encargoId: toId(row.encargoId),
    estudianteId: toId(row.estudianteId),
    archivoUrl: row.archivoUrl,
    nombreArchivo: row.nombreArchivo,
    tipoMime: row.tipoMime,
    tamanioBytes: row.tamanioBytes !== null && row.tamanioBytes !== undefined ? Number(row.tamanioBytes) : null,
    comentario: row.comentario,
    fechaEntrega: asDateTimeString(row.fechaEntrega) ?? "",
    estadoEntrega: row.estadoEntrega as any,
    estudiante: row.usuarioId
      ? {
        id: toId(row.estudianteId),
        usuarioId: toId(row.usuarioId),
        nombre: row.nombre,
        apellidoPaterno: row.apellidoPaterno,
        apellidoMaterno: row.apellidoMaterno,
        numeroDoc: row.numeroDoc,
      }
      : null,
    encargo: row.encargoTitulo
      ? {
        id: toId(row.encargoId),
        titulo: row.encargoTitulo,
        tipo: row.encargoTipo ?? "",
        fechaLimite: row.encargoFechaLimite ? asDateTimeString(row.encargoFechaLimite) : null,
        asignacionId: row.asignacionId ? toId(row.asignacionId) : undefined,
        materiaNombre: row.materiaNombre,
      }
      : null,
  });
}

const SELECT_BASE = `
  SELECT
    ee.id,
    ee.encargo_id AS "encargoId",
    ee.estudiante_id AS "estudianteId",
    ee.archivo_url AS "archivoUrl",
    ee.nombre_archivo AS "nombreArchivo",
    ee.tipo_mime AS "tipoMime",
    ee.tamanio_bytes AS "tamanioBytes",
    ee.comentario,
    ee.fecha_entrega AS "fechaEntrega",
    ee.estado_entrega AS "estadoEntrega",
    e.usuario_id AS "usuarioId",
    u.nombre,
    u.apellido_paterno AS "apellidoPaterno",
    u.apellido_materno AS "apellidoMaterno",
    ud.numero_doc AS "numeroDoc",
    enc.titulo AS "encargoTitulo",
    enc.tipo AS "encargoTipo",
    enc.fecha_limite AS "encargoFechaLimite",
    enc.asignacion_id AS "asignacionId",
    m.nombre AS "materiaNombre",
    ad.maestro_id AS "maestroId"
  FROM encargo_entregas ee
  JOIN estudiantes e ON e.id = ee.estudiante_id
  JOIN usuarios u ON u.id = e.usuario_id
  LEFT JOIN usuario_documentos ud ON ud.usuario_id = u.id AND ud.tipo_doc = 'CI'
  JOIN encargos enc ON enc.id = ee.encargo_id
  JOIN asignaciones_docentes ad ON ad.id = enc.asignacion_id
  JOIN materias m ON m.id = ad.materia_id
`;

export interface ListEntregasFilter {
  encargoId?: string | number;
  estudianteId?: string | number;
  estadoEntrega?: string;
}

export async function listEntregas(
  pagination: PaginationQuery,
  filters: ListEntregasFilter,
  claims?: AuthClaims | null,
): Promise<PaginatedResult<EncargoEntrega>> {
  try {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let idx = 1;

    // RBAC:
    // - Si es estudiante: solo ve sus propias entregas (según su estudiante_id o u.id = sub)
    // - Si es profesor: solo ve entregas de sus materias (ad.maestro_id = maestro.id)
    // - Director / Control: ven todo
    if (claims) {
      if (claims.role === "estudiante") {
        // Encontrar estudiante_id para este usuario
        conditions.push(`e.usuario_id = $${idx++}`);
        values.push(claims.sub);
      } else if (claims.role === "profesor") {
        // Encontrar asignaciones del maestro
        conditions.push(`ad.maestro_id = (SELECT id FROM maestros WHERE usuario_id = $${idx++} LIMIT 1)`);
        values.push(claims.sub);
      }
      // director o control pasan sin restricción
    }

    if (filters.encargoId) {
      conditions.push(`ee.encargo_id = $${idx++}`);
      values.push(filters.encargoId);
    }

    if (filters.estudianteId && claims?.role !== "estudiante") {
      conditions.push(`ee.estudiante_id = $${idx++}`);
      values.push(filters.estudianteId);
    }

    if (filters.estadoEntrega) {
      conditions.push(`ee.estado_entrega = $${idx++}`);
      values.push(filters.estadoEntrega);
    }

    const where = conditions.join(" AND ");

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM encargo_entregas ee
       JOIN estudiantes e ON e.id = ee.estudiante_id
       JOIN encargos enc ON enc.id = ee.encargo_id
       JOIN asignaciones_docentes ad ON ad.id = enc.asignacion_id
       WHERE ${where}`,
      values,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    const dataRes = await query<EntregaRow>(
      `${SELECT_BASE}
       WHERE ${where}
       ORDER BY ee.fecha_entrega DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, pagination.limit, pagination.offset],
    );

    return {
      data: dataRes.rows.map(mapEntrega),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit) || 1,
    };
  } catch (err) {
    throw mapDbError(err, "listar entregas");
  }
}

export async function getEntregaById(
  id: number | string,
  claims?: AuthClaims | null,
): Promise<EncargoEntrega> {
  try {
    const res = await query<EntregaRow & { maestroId?: bigint }>(
      `${SELECT_BASE} WHERE ee.id = $1`,
      [id],
    );

    if (res.rows.length === 0) {
      throw new HttpError(404, `Entrega id=${id} no encontrada`);
    }

    const row = res.rows[0];

    // RBAC check
    if (claims) {
      if (claims.role === "estudiante" && String(row.usuarioId) !== String(claims.sub)) {
        throw new HttpError(403, "No tiene permisos para acceder a esta entrega ajena");
      }
      if (claims.role === "profesor") {
        const mRes = await query<{ id: bigint }>(
          `SELECT id FROM maestros WHERE usuario_id = $1 LIMIT 1`,
          [claims.sub],
        );
        const maestroId = mRes.rows[0]?.id;
        if (!maestroId || String(row.maestroId) !== String(maestroId)) {
          throw new HttpError(403, "No tiene permisos para acceder a entregas de otros docentes");
        }
      }
    }

    return mapEntrega(row);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw mapDbError(err, "obtener entrega");
  }
}

export async function createOrUpdateEntrega(
  input: CreateEncargoEntregaInput,
  claims?: AuthClaims | null,
): Promise<EncargoEntrega> {
  try {
    if (!input.encargoId || !/^\d+$/.test(String(input.encargoId).trim())) {
      throw new HttpError(400, "encargoId debe ser numérico y es requerido");
    }
    if (!input.archivoUrl || !String(input.archivoUrl).trim()) {
      throw new HttpError(400, "archivoUrl es obligatorio para registrar la entrega de la tarea");
    }

    // 1. Obtener encargo para validar fecha límite
    const encRes = await query<{
      id: bigint;
      fecha_limite: Date | string | null;
      estado: string;
      asignacion_id: bigint;
    }>(
      `SELECT id, fecha_limite, estado, asignacion_id FROM encargos WHERE id = $1`,
      [input.encargoId],
    );

    if (encRes.rows.length === 0) {
      throw new HttpError(404, `Encargo id=${input.encargoId} no existe`);
    }

    const enc = encRes.rows[0];
    if (enc.estado === "cancelado") {
      throw new HttpError(400, "Este encargo ha sido cancelado y no admite entregas");
    }

    // 2. Determinar estudiante_id
    let estudianteId = input.estudianteId;
    if (claims?.role === "estudiante" || !estudianteId) {
      const eRes = await query<{ id: bigint }>(
        `SELECT id FROM estudiantes WHERE usuario_id = $1 LIMIT 1`,
        [claims?.sub ?? 0],
      );
      if (eRes.rows.length === 0) {
        throw new HttpError(400, "No se encontró el registro de estudiante para este usuario");
      }
      estudianteId = toId(eRes.rows[0].id);
    } else {
      const eCheck = await query<{ id: bigint }>(
        `SELECT id FROM estudiantes WHERE id = $1 OR usuario_id = $1 LIMIT 1`,
        [estudianteId],
      );
      if (eCheck.rows.length === 0) {
        throw new HttpError(404, `Estudiante id=${estudianteId} no encontrado`);
      }
      estudianteId = toId(eCheck.rows[0].id);
    }

    // 3. Comparar fecha actual del sistema con fecha_limite
    const now = new Date();
    let estadoEntrega: "a_tiempo" | "con_retraso" = "a_tiempo";
    if (enc.fecha_limite) {
      const limite = new Date(enc.fecha_limite);
      if (now.getTime() > limite.getTime()) {
        estadoEntrega = "con_retraso";
      }
    }

    // 4. UPSERT en encargo_entregas
    const upsertRes = await query<{ id: bigint }>(
      `INSERT INTO encargo_entregas (
        encargo_id,
        estudiante_id,
        archivo_url,
        nombre_archivo,
        tipo_mime,
        tamanio_bytes,
        comentario,
        fecha_entrega,
        estado_entrega
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      ON CONFLICT (encargo_id, estudiante_id)
      DO UPDATE SET
        archivo_url = EXCLUDED.archivo_url,
        nombre_archivo = EXCLUDED.nombre_archivo,
        tipo_mime = EXCLUDED.tipo_mime,
        tamanio_bytes = EXCLUDED.tamanio_bytes,
        comentario = EXCLUDED.comentario,
        fecha_entrega = NOW(),
        estado_entrega = EXCLUDED.estado_entrega
      RETURNING id`,
      [
        input.encargoId,
        estudianteId,
        input.archivoUrl,
        input.nombreArchivo ?? null,
        input.tipoMime ?? null,
        input.tamanioBytes ?? null,
        input.comentario ?? null,
        estadoEntrega,
      ],
    );

    const entregaId = toId(upsertRes.rows[0].id);
    return await getEntregaById(entregaId, null);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw mapDbError(err, "registrar entrega de tarea");
  }
}

export async function deleteEntrega(
  id: number | string,
  claims?: AuthClaims | null,
): Promise<void> {
  try {
    const entrega = await getEntregaById(id, claims);
    if (claims?.role === "estudiante" && claims.sub !== entrega.estudiante?.usuarioId) {
      throw new HttpError(403, "No tiene permisos para eliminar esta entrega");
    }

    const res = await query(`DELETE FROM encargo_entregas WHERE id = $1`, [id]);
    if (res.rowCount === 0) {
      throw new HttpError(404, `Entrega id=${id} no encontrada`);
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw mapDbError(err, "eliminar entrega");
  }
}
