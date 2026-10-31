import { query } from "../connects/Database/transaction.ts";
import { dashboardConfig } from "../config/dashboard.config.ts";
import { HttpError } from "../utils/errors.ts";
import { ROLES_DOCENTES, ROLES_INSTITUCION, type AppRole } from "../security/auth.ts";
import type { Alcance, PeriodoRef } from "../models/dashboard.ts";

// servicio -> alcance por rol y periodo

export interface Contexto {
  alcance: Alcance;
  descripcion: string;
  // campo -> periodo elegido
  periodo: PeriodoRef | null;
  // campo -> id maestro docente
  maestroId: string | null;
  usuarioId: string;
  rol: AppRole;
}

export async function resolverContexto(
  usuarioId: string,
  rol: AppRole,
  periodoPedido: string | null | undefined,
  trimestrePedido: number,
): Promise<Contexto> {
  const trimestre = trimestrePedido >= 1 && trimestrePedido <= 3 ? trimestrePedido : 1;

  const { alcance, descripcion, maestroId } = await resolverAlcance(usuarioId, rol);
  const periodo = await resolverPeriodo(periodoPedido, trimestre);

  return { alcance, descripcion, periodo, maestroId, usuarioId, rol };
}

async function resolverAlcance(
  usuarioId: string,
  rol: AppRole,
): Promise<{ alcance: Alcance; descripcion: string; maestroId: string | null }> {
  if (ROLES_INSTITUCION.includes(rol)) {
    return {
      alcance: "institucion",
      descripcion: "Vista institucional completa",
      maestroId: null,
    };
  }

  if (ROLES_DOCENTES.includes(rol)) {
    const res = await query<{ id: bigint }>(
      `SELECT id FROM maestros WHERE usuario_id = $1 AND estado = 'activo' LIMIT 1`,
      [usuarioId],
    );

    if (res.rows.length === 0) {
      // caso -> docente sin ficha
      return {
        alcance: "docente",
        descripcion: "Sin carga horaria asignada",
        maestroId: null,
      };
    }

    return {
      alcance: "docente",
      descripcion: "Sólo tus cursos y clases",
      maestroId: String(res.rows[0].id),
    };
  }

  // caso -> rol sin tablero
  throw new HttpError(403, "El tablero general no está disponible para tu rol");
}

// funcion -> resolver periodo pedido
export async function resolverPeriodo(
  pedido: string | null | undefined,
  trimestre: number,
): Promise<PeriodoRef | null> {
  const solicitado = String(pedido ?? dashboardConfig.periodoPorDefecto).trim();

  if (solicitado && solicitado !== "activo" && solicitado !== "ultimo" && /^\d+$/.test(solicitado)) {
    const porId = await query<RowPeriodo>(
      `SELECT id, nombre, anio, estado, activo FROM periodos_academicos WHERE id = $1`,
      [solicitado],
    );
    if (porId.rows.length === 0) {
      throw new HttpError(404, `No existe el período ${solicitado}`);
    }
    return mapearPeriodo(porId.rows[0], trimestre);
  }

  if (solicitado === "ultimo") {
    const rows = await listarPeriodos(trimestre);
    return rows.length > 0 ? rows[0] : null;
  }

  const activo = await query<RowPeriodo>(
    `SELECT id, nombre, anio, estado, activo
     FROM periodos_academicos
     WHERE activo = true OR estado = 'activo'
     ORDER BY fecha_inicio DESC LIMIT 1`,
  );
  if (activo.rows.length > 0) return mapearPeriodo(activo.rows[0], trimestre);

  const fallback = await listarPeriodos(trimestre);
  return fallback[0] ?? null;
}

export async function listarPeriodos(trimestre = 1): Promise<PeriodoRef[]> {
  const res = await query<RowPeriodo>(
    `SELECT id, nombre, anio, estado, activo
     FROM periodos_academicos
     ORDER BY anio DESC, fecha_inicio DESC`,
  );
  return res.rows.map((fila) => mapearPeriodo(fila, trimestre));
}

interface RowPeriodo {
  id: bigint;
  nombre: string;
  anio: number;
  estado: string;
  activo: boolean;
}

function mapearPeriodo(fila: RowPeriodo, trimestre: number): PeriodoRef {
  return {
    id: String(fila.id),
    nombre: fila.nombre,
    anio: Number(fila.anio),
    estado: fila.estado,
    activo: Boolean(fila.activo),
    trimestre,
  };
}

// funcion -> sql filtro cursos
export function filtroCursos(
  contexto: Contexto,
  params: unknown[],
): { where: string; params: unknown[] } {
  if (contexto.alcance === "docente" && contexto.maestroId) {
    params.push(contexto.maestroId);
    return {
      where: `AND EXISTS (
        SELECT 1 FROM asignaciones_docentes ad
        WHERE ad.curso_periodo_id = cp.id AND ad.maestro_id = $${params.length} AND ad.estado = 'activo'
      )`,
      params,
    };
  }

  return { where: "", params };
}
