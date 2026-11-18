import { query, sTransaction } from "../connects/Database/transaction.ts";
import { HttpError } from "../utils/errors.ts";
import { CompraEstudiante, RecompensaTienda } from "../models/gamification.ts";
import { gamificationConfig } from "../config/gamification.config.ts";
import { fechaLocal, inicioSemana } from "./gamification.calculo.ts";
import { getInfoEstudianteGamificacion } from "./gamification.estudiantes.ts";

// repo -> tienda recompensas
async function getRecompensasActivas(): Promise<RecompensaTienda[]> {
  const res = await query<RecompensaTienda>(`SELECT id, nombre, descripcion,
      costo_puntos_individuales AS "costoPuntosIndividuales", tipo, icono_url AS "iconoUrl", stock, activa
    FROM tienda_recompensas WHERE activa = true AND lower(nombre) IN ('multiplicadores de puntos', 'salvar racha diaria') AND (stock IS NULL OR stock > 0) ORDER BY id`);
  return res.rows;
}

async function comprarRecompensa(
  usuarioId: string,
  recompensaId: string,
): Promise<CompraEstudiante> {
  const recompensaRes = await query<RecompensaTienda>(`SELECT id, nombre, descripcion,
      costo_puntos_individuales AS "costoPuntosIndividuales", tipo, icono_url AS "iconoUrl", stock, activa
    FROM tienda_recompensas WHERE id = $1`, [recompensaId]);
  const recompensa = recompensaRes.rows[0];
  if (!recompensa) throw new HttpError(404, "Recompensa no encontrada");
  if (!recompensa.activa) throw new HttpError(400, "Recompensa no disponible");
  if (!["multiplicadores de puntos", "salvar racha diaria"].includes(recompensa.nombre.trim().toLocaleLowerCase("es"))) throw new HttpError(400, "Recompensa no disponible en la tienda");
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");

  return await sTransaction(async (tx) => {
    await tx.queryObject(`SELECT pg_advisory_xact_lock($1::bigint)`, [usuarioId]);
    const balance = await tx.queryObject<{ total: string }>(
      `SELECT COALESCE(SUM(puntos), 0) AS total FROM puntos_individuales
       WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo],
    );
    if (Number(balance.rows[0]?.total ?? 0) < recompensa.costoPuntosIndividuales) throw new HttpError(400, "Puntos insuficientes");
    if (recompensa.nombre.trim().toLocaleLowerCase("es") === "multiplicadores de puntos") {
      const usados = await tx.queryObject<{ total: string }>(
        `SELECT COUNT(*) AS total FROM compras_estudiante
         WHERE usuario_id = $1 AND recompensa_id = $2
           AND (fecha_compra AT TIME ZONE 'America/La_Paz')::date >= $3::date`,
        [usuarioId, recompensaId, inicioSemana(fechaLocal())],
      );
      if (Number(usados.rows[0]?.total ?? 0) >= gamificationConfig.progresion.multiplicadoresMaximosSemanales) {
        throw new HttpError(400, "Ya alcanzaste el límite de dos multiplicadores esta semana");
      }
    }
    await tx.queryObject(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata)
       VALUES ($1,$2,$3,$4,'canje_tienda',$5,$6,$7)`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fechaLocal(), -recompensa.costoPuntosIndividuales, `Compra: ${recompensa.nombre}`, JSON.stringify({ recompensaId })],
    );
    const res = await tx.queryObject<CompraEstudiante>(
      `INSERT INTO compras_estudiante (usuario_id, curso_periodo_id, paralelo, recompensa_id, puntos_gastados) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, usuario_id AS "usuarioId", curso_periodo_id AS "cursoPeriodoId", paralelo, recompensa_id AS "recompensaId",
                 puntos_gastados AS "puntosGastados", fecha_compra AS "fechaCompra",
                 usada, fecha_uso AS "fechaUso"`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, recompensaId, recompensa.costoPuntosIndividuales],
    );
    return res.rows[0];
  });
}


export async function getTienda(): Promise<RecompensaTienda[]> {
  return getRecompensasActivas();
}

export async function canjearRecompensa(usuarioId: string, recompensaId: string): Promise<CompraEstudiante> {
  return comprarRecompensa(usuarioId, recompensaId);
}
