import { query, sTransaction } from "../../connects/Database/transaction.ts";
import { getRedis } from "../../connects/Redis/redis.ts";
import { HttpError } from "../../utils/errors.ts";
import type { InsigniaEstudiante, TrofeoEstudiante } from "../../models/gamification.ts";
import { gamificationConfig } from "../../config/gamification.config.ts";
import { fechaLocal } from "../gamification.calculo.ts";
import { getInfoEstudianteGamificacion } from "../gamification.estudiantes.ts";
import {
  actualizarDesafiosDiarios,
  agregarPuntosIndividuales,
  otorgarInsignia,
  otorgarTrofeoDiario,
} from "./repository.ts";

export interface ProgresoEstudioInput {
  contentId: string;
  materialId?: string;
  temaRutaId?: string;
  numeroTema?: number;
  tituloTema?: string;
  sesionId?: string;
  partesExplicadas?: string[];
  tiempoLecturaMs?: number;
  preguntaIndagacion?: string;
  titulo?: string;
  materiaNombre?: string;
  formato?: "CARTAS_EXPLICATIVAS" | "ESQUEMA_GEMMA";
  completo?: boolean;
  cartaActual?: number;
  totalCartas?: number;
  investigacion?: boolean;
}

// gamificacion -> registro de avance parcial o completo en rutas de estudio
export async function registrarProgresoEstudio(
  usuarioId: string,
  input: ProgresoEstudioInput,
): Promise<{
  puntosGanados: number;
  trofeosNuevos: TrofeoEstudiante[];
  insigniasNuevas: InsigniaEstudiante[];
  desafiosDiarios: Array<{ codigo: string; nombre: string; completado: boolean }>;
  bonoDesafios: number;
  vecesRepetido?: number;
}> {
  if (!input.contentId || (!input.investigacion && !input.formato)) {
    throw new HttpError(400, "Se requiere material y tipo de progreso");
  }
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");

  const fecha = fechaLocal();
  const esProgresoTema = Boolean(input.temaRutaId && input.materialId);

  if (!input.investigacion && !input.completo) {
    if (esProgresoTema) {
      const key = `gamificacion:tema-progreso:${usuarioId}:${input.temaRutaId}`;
      await getRedis().set(
        key,
        JSON.stringify({
          materialId: input.materialId,
          temaRutaId: input.temaRutaId,
          numeroTema: input.numeroTema ?? 0,
          tituloTema: input.tituloTema || input.titulo || "",
          sesionId: input.sesionId ?? "",
          cartaActual: Math.max(0, input.cartaActual ?? 0),
          totalCartas: Math.max(0, input.totalCartas ?? 0),
          tiempoLecturaMs: Math.max(0, input.tiempoLecturaMs ?? 0),
          partesExplicadas: input.partesExplicadas ?? [],
          actualizadoEn: new Date().toISOString(),
        }),
        "EX",
        30 * 24 * 60 * 60,
      );
      return { puntosGanados: 0, trofeosNuevos: [], insigniasNuevas: [], desafiosDiarios: (await actualizarDesafiosDiarios(usuarioId, fecha)).desafios, bonoDesafios: 0 };
    }

    const key = `gamificacion:resumen:${usuarioId}:${input.contentId}:${fecha}`;
    const totalCartas = Math.max(0, input.totalCartas ?? 0);
    const cartaActual = Math.max(0, Math.min(totalCartas, input.cartaActual ?? 0));
    const ttl = Math.max(60, Math.floor((Date.parse(`${fecha}T23:59:59-04:00`) - Date.now()) / 1000));
    await getRedis().set(key, JSON.stringify({ cartaActual, totalCartas, actualizadoEn: new Date().toISOString() }), "EX", ttl);
    return { puntosGanados: 0, trofeosNuevos: [], insigniasNuevas: [], desafiosDiarios: (await actualizarDesafiosDiarios(usuarioId, fecha)).desafios, bonoDesafios: 0 };
  }

  const metadata: Record<string, unknown> = {
    evento: input.investigacion ? "investigacion" : esProgresoTema ? "tema_completado" : "resumen_completado",
    contentId: input.materialId || input.contentId,
    titulo: input.tituloTema || input.titulo || "",
    materiaNombre: input.materiaNombre ?? "",
    formato: input.formato ?? null,
    materialId: input.materialId || input.contentId,
    temaRutaId: input.temaRutaId || null,
    numeroTema: input.numeroTema ?? null,
    tituloTema: input.tituloTema || input.titulo || "",
    sesionId: input.sesionId || null,
    partesExplicadas: input.partesExplicadas ?? [],
    preguntaIndagacion: input.preguntaIndagacion || null,
    tiempoLecturaMs: Math.max(0, input.tiempoLecturaMs ?? 0),
    cartaActual: Math.max(0, input.cartaActual ?? 0),
    totalCartas: Math.max(0, input.totalCartas ?? 0),
  };

  const txResult = await sTransaction<{ puntosGanados: number; registrado: boolean; vecesRepetido?: number }>(async (tx) => {
    await tx.queryObject(`SELECT pg_advisory_xact_lock($1::bigint)`, [usuarioId]);
    if (esProgresoTema) {
      const duplicate = await tx.queryObject<{ id: string }>(
        `SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'tema_completado' AND metadata->>'sesionId' = $2 LIMIT 1`,
        [usuarioId, input.sesionId ?? ""],
      );
      if (duplicate.rowCount) return { puntosGanados: 0, registrado: false, vecesRepetido: 0 };
      const previas = await tx.queryObject<{ total: string }>(
        `SELECT COUNT(*) AS total FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'tema_completado' AND metadata->>'temaRutaId' = $2`,
        [usuarioId, input.temaRutaId],
      );
      const vecesRepetido = Number(previas.rows[0]?.total ?? 0) + 1;
      metadata.vecesRepetido = vecesRepetido;
      await tx.queryObject(
        `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata) VALUES ($1,$2,$3,$4,'leer_resumen',0,$5,$6::jsonb)`,
        [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, `Tema completado: ${metadata.tituloTema}`, JSON.stringify(metadata)],
      );
      return { puntosGanados: 0, registrado: true, vecesRepetido };
    }

    const dupQuery = input.investigacion
      ? tx.queryObject<{ id: string }>(`SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'investigacion' AND metadata->>'sesionId' = $2 LIMIT 1`, [usuarioId, input.sesionId ?? ""])
      : input.sesionId
      ? tx.queryObject<{ id: string }>(`SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'resumen_completado' AND metadata->>'sesionId' = $2 LIMIT 1`, [usuarioId, input.sesionId])
      : tx.queryObject<{ id: string }>(`SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $6 AND paralelo = $7 AND metadata->>'evento' = $3 AND metadata->>'contentId' = $4 AND COALESCE(metadata->>'formato','') = $5 LIMIT 1`, [usuarioId, fecha, metadata.evento, input.contentId, input.formato ?? "", perfil.cursoPeriodoId, perfil.paralelo]);

    if ((await dupQuery).rowCount) return { puntosGanados: 0, registrado: false, vecesRepetido: 0 };

    await tx.queryObject(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata) VALUES ($1,$2,$3,$4,'leer_resumen',0,$5,$6)`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, input.investigacion ? "Investigación diaria" : "Resumen estudiado", JSON.stringify(metadata)],
    );
    return { puntosGanados: 0, registrado: true, vecesRepetido: 0 };
  });

  await Promise.all([
    esProgresoTema ? getRedis().del(`gamificacion:tema-progreso:${usuarioId}:${input.temaRutaId}`) : Promise.resolve(),
    getRedis().del(`gamificacion:resumen:${usuarioId}:${input.contentId}:${fecha}`),
  ]);

  if (!txResult.registrado) {
    const estadoDiario = await actualizarDesafiosDiarios(usuarioId, fecha);
    return { puntosGanados: 0, trofeosNuevos: [], insigniasNuevas: [], desafiosDiarios: estadoDiario.desafios, bonoDesafios: estadoDiario.bonoNuevo ? gamificationConfig.puntosDiarios.bonoDesafios : 0, vecesRepetido: txResult.vecesRepetido };
  }

  let puntosRutaGanados = 0;
  let trofeosNuevos: TrofeoEstudiante[] = [];
  let insigniasNuevas: InsigniaEstudiante[] = [];

  if (input.investigacion) {
    trofeosNuevos = await otorgarTrofeoDiario(usuarioId, "aprendiendo_mas", { contentId: input.contentId });
  } else if (input.completo && input.formato) {
    const formatos = await query<{ formatos: string[] }>(
      `SELECT ARRAY_AGG(DISTINCT metadata->>'formato') AS formatos FROM puntos_individuales
       WHERE usuario_id = $1 AND curso_periodo_id = $3 AND paralelo = $4 AND metadata->>'evento' = 'resumen_completado' AND metadata->>'contentId' = $2`,
      [usuarioId, input.contentId, perfil.cursoPeriodoId, perfil.paralelo],
    );
    if (["CARTAS_EXPLICATIVAS", "ESQUEMA_GEMMA"].every((formato) => formatos.rows[0]?.formatos?.includes(formato))) {
      const rutaDuplicada = await query<{ existe: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM puntos_individuales WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3 AND metadata->>'evento' = 'ruta_completada' AND metadata->>'contentId' = $4) AS existe`,
        [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, input.contentId],
      );
      if (!rutaDuplicada.rows[0]?.existe) {
        const hoy = await query<{ total: string }>(`SELECT COALESCE(SUM(GREATEST(puntos,0)),0) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]);
        const puntosRuta = Math.min(5, Math.max(0, gamificationConfig.puntosDiarios.maximo - Number(hoy.rows[0]?.total ?? 0)));
        await agregarPuntosIndividuales(usuarioId, fecha, "leer_resumen", puntosRuta, `Ruta completada: ${input.titulo ?? input.contentId}`, { evento: "ruta_completada", contentId: input.contentId });
        puntosRutaGanados = puntosRuta;
      }
      trofeosNuevos = await otorgarTrofeoDiario(usuarioId, "aprendiendo_sin_parar", { contentId: input.contentId });
    }
    const insigniaTema = await query<{ id: string }>(`SELECT id FROM insignias WHERE codigo = 'logro_tema_completo' AND activa = true LIMIT 1`);
    if (insigniaTema.rows[0]) {
      insigniasNuevas = [await otorgarInsignia(usuarioId, insigniaTema.rows[0].id, { contentId: input.contentId, titulo: input.titulo ?? "" })];
    }
  }

  const estadoDiario = await actualizarDesafiosDiarios(usuarioId, fecha);
  return {
    puntosGanados: puntosRutaGanados,
    trofeosNuevos,
    insigniasNuevas,
    desafiosDiarios: estadoDiario.desafios,
    bonoDesafios: estadoDiario.bonoNuevo ? gamificationConfig.puntosDiarios.bonoDesafios : 0,
    vecesRepetido: txResult.vecesRepetido,
  };
}
