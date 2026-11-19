import { query, sTransaction } from "../connects/Database/transaction.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, toNumber } from "../utils/serialize.ts";
import { publicarEventoAsync } from "../utils/events.ts";
import {
  RachasDiarias,
  PuntosIndividuales,
  Insignia,
  InsigniaEstudiante,
  Trofeo,
  TrofeoEstudiante,
  ActividadGamificada,
  RankingEstudiante,
} from "../models/gamification.ts";
import { gamificationConfig } from "../config/gamification.config.ts";
import { calcularProgresion, calcularPuntos, calcularPuntuacion, diaAnterior, fechaLocal, inicioSemana } from "./gamification.calculo.ts";
import { getInfoEstudianteGamificacion, upsertEstudianteGamificacion } from "./gamification.estudiantes.ts";

export { calcularProgresion, calcularPuntos, calcularPuntuacion, diaAnterior, fechaLocal, inicioSemana } from "./gamification.calculo.ts";
export { getInfoEstudianteGamificacion, requerirPerfil, upsertEstudianteGamificacion } from "./gamification.estudiantes.ts";
import { getRedis } from "../connects/Redis/redis.ts";
import { calcularRankingParalelo } from "./gamification.ranking.ts";

// repo -> rachas diarias
function normalizarRacha(row: RachasDiarias | undefined): RachasDiarias | null {
  if (!row) return null;
  return { ...row, porcentajeAcierto: toNumber(row.porcentajeAcierto) };
}

function normalizarActividad(row: ActividadGamificada): ActividadGamificada {
  return { ...row, porcentajeAcierto: toNumber(row.porcentajeAcierto) };
}

async function getRacha(usuarioId: string): Promise<RachasDiarias | null> {
  const res = await query<RachasDiarias>(
    `SELECT id, usuario_id AS "usuarioId", fecha::text AS fecha, completada, aciertos,
            total_preguntas AS "totalPreguntas", porcentaje_acierto::float8 AS "porcentajeAcierto",
            racha_actual AS "rachaActual", mejor_racha AS "mejorRacha",
            salvada_con_puntos AS "salvadaConPuntos", puntos_gastados AS "puntosGastados",
            creada_en AS "creadaEn", actualizada_en AS "actualizadaEn"
     FROM rachas_diarias WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 1`,
    [usuarioId],
  );
  return normalizarRacha(res.rows[0]);
}

async function getRachaByFecha(usuarioId: string, fecha: string): Promise<RachasDiarias | null> {
  const res = await query<RachasDiarias>(
    `SELECT id, usuario_id AS "usuarioId", fecha::text AS fecha, completada, aciertos,
            total_preguntas AS "totalPreguntas", porcentaje_acierto::float8 AS "porcentajeAcierto",
            racha_actual AS "rachaActual", mejor_racha AS "mejorRacha",
            salvada_con_puntos AS "salvadaConPuntos", puntos_gastados AS "puntosGastados",
            creada_en AS "creadaEn", actualizada_en AS "actualizadaEn"
     FROM rachas_diarias WHERE usuario_id = $1 AND fecha = $2`,
    [usuarioId, fecha],
  );
  return normalizarRacha(res.rows[0]);
}

async function crearOActualizarRacha(
  usuarioId: string,
  fecha: string,
  completada: boolean,
  aciertos: number,
  totalPreguntas: number,
  salvadaConPuntos = false,
  puntosGastados = 0,
): Promise<RachasDiarias> {
  const porcentajeAcierto = totalPreguntas > 0 ? aciertos / totalPreguntas : 0;
  const [rachaDeHoy, rachaAnterior] = await Promise.all([
    getRachaByFecha(usuarioId, fecha),
    getRacha(usuarioId),
  ]);
  const mejorRacha = Math.max(rachaDeHoy?.mejorRacha ?? 0, rachaAnterior?.mejorRacha ?? 0);
  const cumpleUmbral = completada && (totalPreguntas === 0 || porcentajeAcierto >= gamificationConfig.racha.umbralAcierto);
  const yaCompletoHoy = Boolean(rachaDeHoy?.completada && !rachaDeHoy.salvadaConPuntos);
  const rachaDeAyer = await getRachaByFecha(usuarioId, diaAnterior(fecha));
  const rachaBase = rachaDeAyer?.completada ? rachaDeAyer.rachaActual : 0;
  const completarHoy = cumpleUmbral || Boolean(rachaDeHoy?.completada) || salvadaConPuntos;
  // intento -> conservar el mejor del dia, un intento posterior peor no degrada la racha
  const mejorIntento = rachaDeHoy && rachaDeHoy.porcentajeAcierto > porcentajeAcierto
    ? { aciertos: rachaDeHoy.aciertos, total: rachaDeHoy.totalPreguntas, porcentaje: rachaDeHoy.porcentajeAcierto }
    : { aciertos, total: totalPreguntas, porcentaje: porcentajeAcierto };
  const aciertosDia = mejorIntento.aciertos;
  const totalDia = mejorIntento.total;
  const porcentajeDia = mejorIntento.porcentaje;
  const rachaActual = cumpleUmbral
    ? (yaCompletoHoy ? rachaDeHoy!.rachaActual : rachaBase + 1)
    : salvadaConPuntos ? (rachaDeHoy?.rachaActual ?? rachaBase) : (rachaDeHoy?.rachaActual ?? rachaBase);
  const mejorRachaActualizada = Math.max(mejorRacha, rachaActual);

  try {
    const res = await query<RachasDiarias>(
      `INSERT INTO rachas_diarias (usuario_id, fecha, completada, aciertos, total_preguntas, porcentaje_acierto, racha_actual, mejor_racha, salvada_con_puntos, puntos_gastados)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET
         completada = EXCLUDED.completada,
         aciertos = EXCLUDED.aciertos,
         total_preguntas = EXCLUDED.total_preguntas,
         porcentaje_acierto = EXCLUDED.porcentaje_acierto,
         racha_actual = EXCLUDED.racha_actual,
         mejor_racha = EXCLUDED.mejor_racha,
         salvada_con_puntos = EXCLUDED.salvada_con_puntos,
         puntos_gastados = EXCLUDED.puntos_gastados,
         actualizada_en = NOW()
       RETURNING id, usuario_id AS "usuarioId", fecha::text AS fecha, completada, aciertos,
                 total_preguntas AS "totalPreguntas", porcentaje_acierto::float8 AS "porcentajeAcierto",
                 racha_actual AS "rachaActual", mejor_racha AS "mejorRacha",
                 salvada_con_puntos AS "salvadaConPuntos", puntos_gastados AS "puntosGastados",
                 creada_en AS "creadaEn", actualizada_en AS "actualizadaEn"`,
      [
        usuarioId,
        fecha,
        completarHoy,
        aciertosDia,
        totalDia,
        porcentajeDia,
        rachaActual,
        mejorRachaActualizada,
        salvadaConPuntos,
        puntosGastados,
      ],
    );
    return normalizarRacha(res.rows[0]) as RachasDiarias;
  } catch (err) {
    throw mapDbError(err, "Error al guardar racha diaria");
  }
}

// repo -> puntos individuales
async function agregarPuntosIndividuales(
  usuarioId: string,
  fecha: string,
  tipo: PuntosIndividuales["tipo"],
  puntos: number,
  descripcion: string,
  metadata?: Record<string, unknown>,
): Promise<PuntosIndividuales> {
  try {
    const perfil = await getInfoEstudianteGamificacion(usuarioId);
    if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");
    const res = await query<PuntosIndividuales>(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, usuario_id AS "usuarioId", curso_periodo_id AS "cursoPeriodoId", paralelo, fecha::text AS fecha, tipo, puntos, descripcion, metadata, creada_en AS "creadaEn"`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, tipo, puntos, descripcion, JSON.stringify(metadata ?? {})],
    );
    return res.rows[0];
  } catch (err) {
    throw mapDbError(err, "Error al agregar puntos individuales");
  }
}

async function getTotalPuntosIndividuales(usuarioId: string): Promise<number> {
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) return 0;
  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(puntos), 0) AS total FROM puntos_individuales
     WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3`,
    [usuarioId, perfil.cursoPeriodoId, perfil.paralelo],
  );
  return Number(res.rows[0]?.total ?? 0);
}

async function gastarPuntosIndividuales(
  usuarioId: string,
  fecha: string,
  puntos: number,
  tipo: PuntosIndividuales["tipo"],
  descripcion: string,
): Promise<void> {
  const total = await getTotalPuntosIndividuales(usuarioId);
  if (total < puntos) {
    throw new HttpError(400, "Puntos insuficientes");
  }
  await agregarPuntosIndividuales(usuarioId, fecha, tipo, -puntos, descripcion);
}

// repo -> puntos globales
// repo -> insignias
async function getInsigniasActivas(): Promise<Insignia[]> {
  const res = await query<Insignia>(
    `SELECT id, codigo, nombre, descripcion, icono_url AS "iconoUrl", criterio, activa
     FROM insignias WHERE activa = true`,
  );
  return res.rows;
}

async function getInsigniasEstudiante(usuarioId: string): Promise<InsigniaEstudiante[]> {
  const res = await query<InsigniaEstudiante>(
    `SELECT ie.id, ie.usuario_id AS "usuarioId", ie.insignia_id AS "insigniaId",
            ie.fecha_obtencion AS "fechaObtencion", ie.metadata, i.codigo, i.nombre
     FROM insignias_estudiante ie JOIN insignias i ON i.id = ie.insignia_id
     WHERE ie.usuario_id = $1`,
    [usuarioId],
  );
  return res.rows;
}

async function otorgarInsignia(usuarioId: string, insigniaId: string, metadata?: Record<string, unknown>): Promise<InsigniaEstudiante> {
  try {
    const res = await query<InsigniaEstudiante>(
      `INSERT INTO insignias_estudiante (usuario_id, insignia_id, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id, usuario_id AS "usuarioId", insignia_id AS "insigniaId",
                 fecha_obtencion AS "fechaObtencion", metadata`,
      [usuarioId, insigniaId, JSON.stringify(metadata ?? {})],
    );
    if (res.rows.length > 0) {
      publicarEventoAsync(gamificationConfig.wsEventos.insigniaGanada, {
        usuarioId,
        insigniaId,
        fecha: new Date().toISOString(),
      });
    }
    return res.rows[0] ?? { usuarioId, insigniaId, fechaObtencion: new Date().toISOString() } as InsigniaEstudiante;
  } catch (err) {
    throw mapDbError(err, "Error al otorgar insignia");
  }
}

// repo -> trofeos
async function getTrofeosActivos(): Promise<Trofeo[]> {
  const res = await query<Trofeo>(
    `SELECT id, codigo, nombre, descripcion, icono_url AS "iconoUrl", puntos, criterio, periodo, activo
     FROM trofeos WHERE activo = true`,
  );
  return res.rows;
}

async function getTrofeosEstudiante(usuarioId: string): Promise<TrofeoEstudiante[]> {
  const res = await query<TrofeoEstudiante>(
    `SELECT te.id, te.usuario_id AS "usuarioId", te.trofeo_id AS "trofeoId",
            te.fecha_obtencion AS "fechaObtencion", te.puntos_otorgados AS "puntosOtorgados",
            te.metadata, t.nombre AS "trofeoNombre", t.codigo AS "trofeoCodigo", t.descripcion AS "trofeoDescripcion"
     FROM trofeos_estudiante te JOIN trofeos t ON t.id = te.trofeo_id WHERE te.usuario_id = $1
     ORDER BY te.fecha_obtencion DESC`,
    [usuarioId],
  );
  return res.rows;
}

async function otorgarTrofeo(
  usuarioId: string,
  trofeoId: string,
  puntosOtorgados: number,
  metadata?: Record<string, unknown>,
): Promise<TrofeoEstudiante | null> {
  try {
    const res = await query<TrofeoEstudiante>(
      `INSERT INTO trofeos_estudiante (usuario_id, trofeo_id, puntos_otorgados, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING id, usuario_id AS "usuarioId", trofeo_id AS "trofeoId",
                 fecha_obtencion AS "fechaObtencion", puntos_otorgados AS "puntosOtorgados", metadata`,
      [usuarioId, trofeoId, puntosOtorgados, JSON.stringify(metadata ?? {})],
    );
    if (res.rows.length > 0) {
      publicarEventoAsync(gamificationConfig.wsEventos.trofeoGanado, {
        usuarioId,
        trofeoId,
        puntosOtorgados,
        fecha: new Date().toISOString(),
      });
    }
    return res.rows[0] ?? null;
  } catch (err) {
    throw mapDbError(err, "Error al otorgar trofeo");
  }
}

// service -> trofeo diario
async function otorgarTrofeoDiario(usuarioId: string, codigo: string, metadata: Record<string, unknown> = {}): Promise<TrofeoEstudiante[]> {
  const trofeoRes = await query<Trofeo>(
    `SELECT id, codigo, nombre, descripcion, icono_url AS "iconoUrl", puntos, criterio, periodo, activo
     FROM trofeos WHERE codigo = $1 AND activo = true LIMIT 1`,
    [codigo],
  );
  const trofeo = trofeoRes.rows[0];
  if (!trofeo) return [];
  const otorgado = await otorgarTrofeo(usuarioId, trofeo.id, trofeo.puntos, { ...metadata, fechaDia: fechaLocal() });
  return otorgado ? [otorgado] : [];
}

// repo -> actividades gamificadas
async function registrarActividad(actividad: Omit<ActividadGamificada, "id" | "creadaEn">): Promise<ActividadGamificada> {
  try {
    const res = await query<ActividadGamificada>(
      `INSERT INTO actividades_gamificadas (
         usuario_id, estudiante_id, curso_periodo_id, paralelo, tipo, materia_id, materia_nombre, titulo,
         preguntas, respuestas, aciertos, total, porcentaje_acierto,
         tiempo_total_ms, puntos_ganados, puntos_calidad, puntos_tiempo, completada,
         fecha_inicio, fecha_fin
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id, usuario_id AS "usuarioId", estudiante_id AS "estudianteId", curso_periodo_id AS "cursoPeriodoId", paralelo, tipo,
                 materia_id AS "materiaId", materia_nombre AS "materiaNombre", titulo,
                 preguntas, respuestas, aciertos, total,
                 porcentaje_acierto::float8 AS "porcentajeAcierto",
                 tiempo_total_ms AS "tiempoTotalMs", puntos_ganados AS "puntosGanados",
                 puntos_calidad AS "puntosCalidad", puntos_tiempo AS "puntosTiempo",
                 completada, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin"`,
      [
        actividad.usuarioId,
        actividad.estudianteId,
        actividad.cursoPeriodoId,
        actividad.paralelo,
        actividad.tipo,
        actividad.materiaId,
        actividad.materiaNombre,
        actividad.titulo,
        JSON.stringify(actividad.contexto
          ? actividad.preguntas.map((pregunta) => ({ ...pregunta, contexto: actividad.contexto }))
          : actividad.preguntas),
        JSON.stringify(actividad.respuestas),
        actividad.aciertos,
        actividad.total,
        actividad.porcentajeAcierto,
        actividad.tiempoTotalMs,
        actividad.puntosGanados,
        actividad.puntosCalidad,
        actividad.puntosTiempo,
        actividad.completada,
        actividad.fechaInicio,
        actividad.fechaFin ?? null,
      ],
    );
    return normalizarActividad(res.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al registrar actividad gamificada");
  }
}

async function getActividadesEstudiante(usuarioId: string, limite = 50): Promise<ActividadGamificada[]> {
  const res = await query<ActividadGamificada>(
    `SELECT id, usuario_id AS "usuarioId", estudiante_id AS "estudianteId", curso_periodo_id AS "cursoPeriodoId", paralelo, tipo,
            materia_id AS "materiaId", materia_nombre AS "materiaNombre", titulo,
            preguntas, respuestas, aciertos, total,
            porcentaje_acierto::float8 AS "porcentajeAcierto",
            tiempo_total_ms AS "tiempoTotalMs", puntos_ganados AS "puntosGanados",
            puntos_calidad AS "puntosCalidad", puntos_tiempo AS "puntosTiempo",
            completada, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin"
     FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT $2`,
    [usuarioId, limite],
  );
  return res.rows.map(normalizarActividad);
}

// service -> logica principal
// desafio -> calcular estado diario persistente
async function actualizarDesafiosDiarios(usuarioId: string, fecha = fechaLocal()): Promise<{
  desafios: Array<{ codigo: string; nombre: string; completado: boolean }>;
  bonoOtorgado: boolean;
  bonoNuevo: boolean;
}> {
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) return { desafios: [], bonoOtorgado: false, bonoNuevo: false };
  const [actividad, resumen, puntos] = await Promise.all([
    query<{ total: string }>(`SELECT COUNT(*) AS total FROM actividades_gamificadas WHERE usuario_id = $1 AND curso_periodo_id = $3 AND paralelo = $4 AND completada = true AND (fecha_inicio AT TIME ZONE 'America/La_Paz')::date = $2`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ formatos: string[]; total: string }>(`SELECT COALESCE(ARRAY_AGG(DISTINCT metadata->>'formato') FILTER (WHERE metadata->>'evento' IN ('resumen_completado', 'tema_completado')), ARRAY[]::text[]) AS formatos, COUNT(*) FILTER (WHERE metadata->>'evento' IN ('resumen_completado', 'tema_completado')) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ total: string }>(`SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
  ]);
  const formatos = resumen.rows[0]?.formatos ?? [];
  const hayActividad = Number(actividad.rows[0]?.total ?? 0) > 0;
  const hayResumen = Number(resumen.rows[0]?.total ?? 0) > 0;
  const puntosBase = Number(puntos.rows[0]?.total ?? 0);
  const desafios = [
    { codigo: "resumen", nombre: "Complete un tema o su resumen.", completado: hayResumen },
    { codigo: "actividad", nombre: "Realice una actividad.", completado: hayActividad },
    { codigo: "puntos", nombre: `Consiga ${gamificationConfig.puntosDiarios.maximo} puntos en el día.`, completado: puntosBase >= gamificationConfig.puntosDiarios.maximo },
    { codigo: "cartas", nombre: "Complete un tema o resumen en Cartas.", completado: formatos.includes("CARTAS_EXPLICATIVAS") },
    { codigo: "esquema", nombre: "Complete el resumen en Esquema.", completado: formatos.includes("ESQUEMA_GEMMA") },
  ];
  let bonoOtorgado = false;
  let bonoNuevo = false;
  const semana = inicioSemana(fecha);
  const diasActivos = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM rachas_diarias WHERE usuario_id = $1 AND completada = true AND fecha >= $2::date AND fecha <= $3::date`,
    [usuarioId, semana, fecha],
  );
  const cumpleSemana = Number(diasActivos.rows[0]?.total ?? 0) >= 5;
  if (cumpleSemana) {
    const limite = gamificationConfig.puntosDiarios.maximo;
    const restantes = Math.max(0, limite - Number(puntos.rows[0]?.total ?? 0));
    const result = await query<{ id: string }>(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata)
       VALUES ($1,$2,$3,$4,'ajuste_manual',$5,'Bono semanal por cinco días de estudio',$6::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, Math.min(gamificationConfig.puntosDiarios.bonoDesafios, restantes), JSON.stringify({ evento: "bono_desafios_semanales", semana })],
    );
    bonoNuevo = result.rowCount > 0;
    bonoOtorgado = bonoNuevo || Number((await query<{ total: string }>(`SELECT COUNT(*) AS total FROM puntos_individuales WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3 AND metadata->>'evento' = 'bono_desafios_semanales' AND metadata->>'semana' = $4`, [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, semana])).rows[0]?.total ?? 0) > 0;
  }
  return { desafios, bonoOtorgado, bonoNuevo };
}

export async function procesarActividadCompletada(input: {
  usuarioId: string;
  estudianteId: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
  materiaId: string;
  materiaNombre: string;
  tipo: ActividadGamificada["tipo"];
  titulo: string;
  preguntas: ActividadGamificada["preguntas"];
  respuestas: ActividadGamificada["respuestas"];
  tiempoTotalMs: number;
  fechaInicio: string;
  fechaFin: string;
  contexto?: { materialId: string; temaRutaId?: string; numeroTema?: number; tituloTema?: string };
  mediaTiempoOtrosMs?: number; // Para gamificación: tiempo promedio de otros estudiantes
  intentoAnterior?: { puntuacion: number; fecha: string } | null; // Para insignia de mejora
}): Promise<{
  actividad: ActividadGamificada;
  racha: RachasDiarias;
  puntosGanados: number;
  bonusSpeedrun: number;
  speedrun: boolean;
  puntuacion: number; // Nueva puntuación 2-10
  insigniasNuevas: InsigniaEstudiante[];
  trofeosNuevos: TrofeoEstudiante[];
  bonoDesafios: number;
}> {
  const fecha = fechaLocal();
  const { aciertos, total, porcentajeAcierto, puntosGanados: puntosCalculados, puntosCalidad, puntosTiempo } = calcularPuntos(
    input.respuestas,
    input.preguntas,
    input.tiempoTotalMs,
  );

  const completada = input.respuestas.length === input.preguntas.length && total > 0;
  const speedrun = total >= 5 && porcentajeAcierto >= 0.8 &&
    input.tiempoTotalMs > 0 && input.tiempoTotalMs <= 30000;
  
  // Nueva puntuación 2-10 para gamificación
  const mediaTiempoOtros = input.mediaTiempoOtrosMs ?? 0;
  const puntuacion = calcularPuntuacion(aciertos, total, input.tiempoTotalMs, mediaTiempoOtros);

  // transaccion -> procesar actividad completada
  const resultado = await sTransaction(async (_tx) => {
    await _tx.queryObject(`SELECT pg_advisory_xact_lock($1::bigint)`, [input.usuarioId]);
    await upsertEstudianteGamificacion({ usuarioId: input.usuarioId, estudianteId: input.estudianteId, cursoPeriodoId: input.cursoPeriodoId, paralelo: input.paralelo });
    const puntosHoyRes = await query<{ total: string }>(
      `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
       WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`,
      [input.usuarioId, fecha, input.cursoPeriodoId, input.paralelo],
    );
    const puntosHoy = Number(puntosHoyRes.rows[0]?.total ?? 0);
    const dobleDisponible = await query<{ id: string }>(
      `UPDATE compras_estudiante ce SET usada = true, fecha_uso = NOW()
       WHERE ce.id = (
         SELECT ce2.id FROM compras_estudiante ce2
         JOIN tienda_recompensas tr ON tr.id = ce2.recompensa_id
         WHERE ce2.usuario_id = $1 AND ce2.curso_periodo_id = $3 AND ce2.paralelo = $4 AND ce2.usada = false AND lower(tr.nombre) = 'multiplicadores de puntos'
         ORDER BY ce2.fecha_compra LIMIT 1
       ) AND $2 = true RETURNING ce.id`,
      [input.usuarioId, completada, input.cursoPeriodoId, input.paralelo],
    );
    const puntosBaseActividad = completada ? Math.min(10, Math.max(5, puntosCalculados)) : 0;
    const puntosConBonificacion = puntosBaseActividad * (dobleDisponible.rowCount > 0 ? 2 : 1) + (speedrun ? 2 : 0);
    const puntosGanados = Math.max(0, Math.min(puntosConBonificacion, gamificationConfig.puntosDiarios.maximo - puntosHoy));
    const bonusSpeedrun = speedrun
      ? Math.min(2, Math.max(0, puntosGanados - Math.min(puntosBaseActividad * (dobleDisponible.rowCount > 0 ? 2 : 1), Math.max(0, gamificationConfig.puntosDiarios.maximo - puntosHoy))))
      : 0;

    const actividad = await registrarActividad({
      ...input,
      aciertos,
      total,
      porcentajeAcierto,
      tiempoTotalMs: input.tiempoTotalMs,
      puntosGanados,
      puntosCalidad,
      puntosTiempo,
      completada,
      fechaInicio: input.fechaInicio,
      fechaFin: input.fechaFin,
    });

    const racha = await crearOActualizarRacha(
      input.usuarioId,
      fecha,
      puntosHoy + puntosGanados >= 10,
      0,
      0,
      false,
      0,
    );

    if (puntosGanados > 0) {
      await agregarPuntosIndividuales(
        input.usuarioId,
        fecha,
        "respuesta_correcta",
        puntosGanados,
        `Actividad: ${actividad.titulo}`,
        { actividadId: actividad.id, aciertos, total },
      );
    }


    // Evaluar insignias tradicionales + dinámicas
    const insigniasTradicionales = await evaluarInsignias(input.usuarioId, input.estudianteId, {
      actividad,
      racha,
      puntosGanados,
      aciertos,
      total,
      tiempoTotalMs: input.tiempoTotalMs,
    });
    
    const insigniasDinamicas = await otorgarInsigniaDinamica(
      input.usuarioId,
      puntuacion,
      input.tiempoTotalMs,
      mediaTiempoOtros,
      input.intentoAnterior ?? null,
    );
    
    const insigniasNuevas = [...insigniasTradicionales, ...insigniasDinamicas];

    const trofeosNuevos = await evaluarTrofeos(input.usuarioId, input.cursoPeriodoId, input.paralelo);

    if (speedrun) trofeosNuevos.push(...await otorgarTrofeoDiario(input.usuarioId, "speedrunner", { actividadId: actividad.id }));

    return { actividad, racha, puntosGanados, bonusSpeedrun, speedrun, puntuacion, insigniasNuevas, trofeosNuevos };
  });
  const estadoDiario = await actualizarDesafiosDiarios(input.usuarioId, fecha);
  return { ...resultado, bonoDesafios: estadoDiario.bonoNuevo ? gamificationConfig.puntosDiarios.bonoDesafios : 0 };
}

// gamificacion -> insignia dinamica
export async function otorgarInsigniaDinamica(
  estudianteId: string,
  puntuacion: number,
  tiempoMs: number,
  mediaTiempoOtros: number,
  intentoAnterior: { puntuacion: number; fecha: string } | null,
): Promise<InsigniaEstudiante[]> {
  const nuevas: InsigniaEstudiante[] = [];
  const insigniasActivas = await getInsigniasActivas();
  const insigniasEstudiante = await getInsigniasEstudiante(estudianteId);
  const tieneInsignia = new Set(insigniasEstudiante.map((i) => i.insigniaId));
  
  // Determinar insignia según puntuación y mejora
  let codigoInsignia: string | null = null;
  let metadata: Record<string, unknown> = { puntuacion };
  
  if (puntuacion === 10) {
    codigoInsignia = "maestro_perfecto";
  } else if (puntuacion >= 8) {
    codigoInsignia = "experto_rapido";
  } else if (puntuacion >= 6) {
    codigoInsignia = "vamos_buen_camino";
  } else if (puntuacion >= 4) {
    codigoInsignia = "esfuerzo_constante";
  } else {
    codigoInsignia = "empezando";
  }
  
  // Si hay intento anterior y mejoró significativamente
  if (intentoAnterior && puntuacion > intentoAnterior.puntuacion + 2) {
    codigoInsignia = "mejora_notable";
    metadata = { ...metadata, mejora: puntuacion - intentoAnterior.puntuacion };
  }
  
  // Speedrunner: 10 puntos en tiempo récord (menos de la mitad de la media)
  if (puntuacion === 10 && tiempoMs > 0 && mediaTiempoOtros > 0 && tiempoMs < mediaTiempoOtros / 2) {
    codigoInsignia = "speedrunner";
  }
  
  const insignia = insigniasActivas.find((i) => i.codigo === codigoInsignia);
  if (insignia && !tieneInsignia.has(insignia.id)) {
    const otorgada = await otorgarInsignia(estudianteId, insignia.id, metadata);
    if (otorgada) nuevas.push(otorgada);
  }
  
  return nuevas;
}

async function evaluarInsignias(
  usuarioId: string,
  _estudianteId: string,
  contexto: {
    actividad: ActividadGamificada;
    racha: RachasDiarias;
    puntosGanados: number;
    aciertos: number;
    total: number;
    tiempoTotalMs: number;
  },
): Promise<InsigniaEstudiante[]> {
  const nuevas: InsigniaEstudiante[] = [];
  const insigniasActivas = await getInsigniasActivas();
  const insigniasEstudiante = await getInsigniasEstudiante(usuarioId);
  const tieneInsignia = new Set(insigniasEstudiante.map((i) => i.insigniaId));

  for (const insignia of insigniasActivas) {
    if (tieneInsignia.has(insignia.id)) continue;
    let cumple = false;

    switch (insignia.codigo) {
      case "speedrun":
        if (
          contexto.total >= 5 &&
          contexto.aciertos / contexto.total >= 0.8 &&
          contexto.tiempoTotalMs > 0 &&
          contexto.tiempoTotalMs <= 30000
        ) cumple = true;
        break;
      case "nuevo_aprendizaje":
        const actMateria = await query<{ count: string }>(
          `SELECT COUNT(*) FROM actividades_gamificadas WHERE usuario_id = $1 AND materia_id = $2`,
          [usuarioId, contexto.actividad.materiaId],
        );
        if (Number(actMateria.rows[0]?.count ?? 0) === 1) cumple = true;
        break;
      case "repaso_masivo":
        if (contexto.total >= 20 && contexto.aciertos >= contexto.total * 0.8) cumple = true;
        break;
      case "reincorporacion":
        const ultima = await query<{ fecha_inicio: string }>(
          `SELECT fecha_inicio FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT 2`,
          [usuarioId],
        );
        if (ultima.rows.length === 2) {
          const diff = new Date(ultima.rows[0].fecha_inicio).getTime() - new Date(ultima.rows[1].fecha_inicio).getTime();
          if (diff > 7 * 24 * 60 * 60 * 1000) cumple = true;
        }
        break;
    }

    if (cumple) {
      const otorgada = await otorgarInsignia(usuarioId, insignia.id, { contexto: insignia.codigo });
      if (otorgada) nuevas.push(otorgada);
    }
  }
  return nuevas;
}

// eval -> trofeos periodicos estudiante
async function evaluarTrofeos(
  usuarioId: string,
  cursoPeriodoId: string,
  paralelo: "A" | "B",
): Promise<TrofeoEstudiante[]> {
  const nuevos: TrofeoEstudiante[] = [];
  const trofeosActivos = await getTrofeosActivos();
  const trofeosEstudiante = await getTrofeosEstudiante(usuarioId);
  const tieneTrofeo = new Set(trofeosEstudiante.map((t) => t.trofeoId));

  const rankings = await calcularRankingParalelo(cursoPeriodoId);
  const miRanking = rankings.find((r) => r.paralelo === paralelo);
  const miPosicion = miRanking?.estudiantes.find((e) => e.usuarioId === usuarioId)?.posicion ?? 999;

  for (const trofeo of trofeosActivos) {
    if (tieneTrofeo.has(trofeo.id)) continue;
    let cumple = false;

    switch (trofeo.codigo) {
      case "mejor_semana":
        if (miPosicion === 1) cumple = true;
        break;
      case "alto_rendimiento":
        const rend = await query<{ avg: string }>(
          `SELECT AVG(porcentaje_acierto) AS avg FROM actividades_gamificadas WHERE usuario_id = $1 AND completada = true AND fecha_inicio >= NOW() - INTERVAL '3 months'`,
          [usuarioId],
        );
        if (Number(rend.rows[0]?.avg ?? 0) >= 0.9) cumple = true;
        break;
      case "dominio_total":
        const insig = await query<{ count: string }>(
          `SELECT COUNT(*) FROM insignias_estudiante WHERE usuario_id = $1`,
          [usuarioId],
        );
        const totalIns = await query<{ count: string }>(`SELECT COUNT(*) FROM insignias WHERE activa = true`);
        if (Number(insig.rows[0]?.count ?? 0) >= Number(totalIns.rows[0]?.count ?? 0)) cumple = true;
        break;
    }

    if (cumple) {
      const otorgado = await otorgarTrofeo(usuarioId, trofeo.id, trofeo.puntos);
      if (otorgado) nuevos.push(otorgado);
    }
  }
  return nuevos;
}

// service -> racha
export async function salvarRachaConPuntos(usuarioId: string): Promise<RachasDiarias> {
  const fecha = fechaLocal();
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");
  const racha = await getRachaByFecha(usuarioId, fecha);
  if (!racha || racha.completada) {
    throw new HttpError(400, "No hay racha para salvar o ya completada");
  }
  const salvadorComprado = await query<{ id: string }>(
    `UPDATE compras_estudiante ce SET usada = true, fecha_uso = NOW()
     WHERE ce.id = (
       SELECT ce2.id FROM compras_estudiante ce2
       JOIN tienda_recompensas tr ON tr.id = ce2.recompensa_id
       WHERE ce2.usuario_id = $1 AND ce2.curso_periodo_id = $2 AND ce2.paralelo = $3 AND ce2.usada = false AND tr.tipo = 'salvar_racha'
       ORDER BY ce2.fecha_compra LIMIT 1
     )
     RETURNING ce.id`,
    [usuarioId, perfil.cursoPeriodoId, perfil.paralelo],
  );
  const costo = salvadorComprado.rowCount > 0 ? 0 : gamificationConfig.racha.costoSalvarRacha;
  if (costo > 0) await gastarPuntosIndividuales(usuarioId, fecha, costo, "salvar_racha", "Salvar racha diaria");
  return await crearOActualizarRacha(usuarioId, fecha, true, 0, 0, true, costo);
}

export async function usarPistaExamen(usuarioId: string): Promise<void> {
  const fecha = fechaLocal();
  const costo = gamificationConfig.pistas.costo;
  await gastarPuntosIndividuales(usuarioId, fecha, costo, "pista_examen", "Pista en examen");
}

// service -> resumen gamificacion estudiante
export async function getResumenEstudiante(usuarioId: string): Promise<{
  racha: RachasDiarias | null;
  puntosIndividuales: number;
  puntosCurso: number;
  nivel: number;
  rango: "D" | "C" | "B" | "A" | "S";
  puntosSiguienteNivel: number;
  tag: string | null;
  puntosHoy: number;
  limiteDiario: number;
  insignias: InsigniaEstudiante[];
  trofeos: TrofeoEstudiante[];
  ranking: RankingEstudiante | null;
  aprendizajeHoy: Array<{ titulo: string; materiaNombre: string; porcentajeAcierto: number; aciertos: number; total: number; fechaFin: string | null; feedback: string | null }>;
  investigarSiguiente: string | null;
  desafiosDiarios: Array<{ codigo: string; nombre: string; completado: boolean }>;
  bonoDesafiosOtorgado: boolean;
}> {
  const infoEst = await getInfoEstudianteGamificacion(usuarioId);
  const fecha = fechaLocal();
  const estadoDiario = await actualizarDesafiosDiarios(usuarioId, fecha);
  const [ultimaRacha, totalIndividuales, puntosGanadosCurso, insignias, trofeos, puntosHoyRes, actividadesHoyRes] = await Promise.all([
    getRacha(usuarioId),
    getTotalPuntosIndividuales(usuarioId),
    infoEst ? query<{ total: string }>(
      `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
       WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3`,
      [usuarioId, infoEst.cursoPeriodoId, infoEst.paralelo],
    ).then((res) => Number(res.rows[0]?.total ?? 0)) : Promise.resolve(0),
    getInsigniasEstudiante(usuarioId),
    getTrofeosEstudiante(usuarioId),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
       WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`,
      [usuarioId, fecha, infoEst?.cursoPeriodoId ?? "", infoEst?.paralelo ?? ""],
    ),
    query<{ titulo: string; materia_nombre: string; porcentaje_acierto: number; aciertos: number; total: number; fecha_fin: string | null; feedback: string | null }>(
      `SELECT titulo, materia_nombre, porcentaje_acierto, aciertos, total, fecha_fin, feedback FROM (
         SELECT titulo, materia_nombre, porcentaje_acierto, aciertos, total, fecha_fin AS fecha_fin, respuestas->0->>'feedback' AS feedback, fecha_inicio AS orden
         FROM actividades_gamificadas
         WHERE usuario_id = $1 AND (fecha_inicio AT TIME ZONE 'America/La_Paz')::date = $2
         UNION ALL
         SELECT CASE WHEN metadata->>'evento' = 'investigacion' THEN 'Investigación diaria: ' || COALESCE(metadata->>'titulo', 'tema') WHEN metadata->>'evento' = 'tema_completado' THEN 'Tema completado: ' || COALESCE(metadata->>'tituloTema', metadata->>'titulo', 'tema') ELSE COALESCE(metadata->>'titulo', 'Resumen ' || COALESCE(metadata->>'formato', 'estudiado')) END,
                COALESCE(metadata->>'materiaNombre', 'Estudio personal'), 1.0, 1, 1, creada_en, NULL::text, creada_en
         FROM puntos_individuales
         WHERE usuario_id = $1 AND fecha = $2 AND metadata->>'evento' IN ('resumen_completado', 'investigacion', 'tema_completado')
       ) aprendizaje ORDER BY orden DESC LIMIT 10`,
      [usuarioId, fecha],
    ),
  ]);
  const racha = ultimaRacha && ultimaRacha.fecha === fecha
    ? ultimaRacha
    : ultimaRacha
    ? { ...ultimaRacha, fecha, completada: false, aciertos: 0, totalPreguntas: 0, porcentajeAcierto: 0, rachaActual: 0 }
    : null;

  return {
    racha,
    puntosIndividuales: totalIndividuales,
    puntosCurso: puntosGanadosCurso,
    ...calcularProgresion(puntosGanadosCurso),
    tag: infoEst?.tag ?? null,
    puntosHoy: Number(puntosHoyRes.rows[0]?.total ?? 0),
    limiteDiario: gamificationConfig.puntosDiarios.maximo,
    insignias,
    trofeos,
    ranking: null,
    aprendizajeHoy: actividadesHoyRes.rows.map((item) => ({
      titulo: item.titulo,
      materiaNombre: item.materia_nombre,
      porcentajeAcierto: Number(item.porcentaje_acierto),
      aciertos: item.aciertos,
      total: item.total,
      fechaFin: item.fecha_fin ? asDateTimeString(item.fecha_fin) : null,
      feedback: item.feedback,
    })),
    investigarSiguiente: actividadesHoyRes.rows[0]?.materia_nombre
      ? `Investiga un ejemplo práctico nuevo de ${actividadesHoyRes.rows[0].materia_nombre} y relaciónalo con lo que estudiaste.`
      : null,
    desafiosDiarios: estadoDiario.desafios,
    bonoDesafiosOtorgado: estadoDiario.bonoOtorgado,
  };
}

export { getEvidenciaAprendizaje } from "./gamification.evidencia.ts";

export { canjearRecompensa, getTienda } from "./gamification.tienda.ts";

export async function registrarProgresoEstudio(usuarioId: string, input: {
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
}): Promise<{ puntosGanados: number; trofeosNuevos: TrofeoEstudiante[]; insigniasNuevas: InsigniaEstudiante[]; desafiosDiarios: Array<{ codigo: string; nombre: string; completado: boolean }>; bonoDesafios: number; vecesRepetido?: number }> {
  if (!input.contentId || (!input.investigacion && !input.formato)) throw new HttpError(400, "Se requiere material y tipo de progreso");
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");
  const fecha = fechaLocal();
  const esProgresoTema = Boolean(input.temaRutaId && input.materialId);
  if (!input.investigacion && !input.completo) {
    if (esProgresoTema) {
      const key = `gamificacion:tema-progreso:${usuarioId}:${input.temaRutaId}`;
      const progreso = {
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
      };
      await getRedis().set(key, JSON.stringify(progreso), "EX", 30 * 24 * 60 * 60);
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
      metadata["vecesRepetido"] = vecesRepetido;
      await tx.queryObject(
        `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata) VALUES ($1,$2,$3,$4,'leer_resumen',0,$5,$6::jsonb)`,
        [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, `Tema completado: ${metadata.tituloTema}`, JSON.stringify(metadata)],
      );
      return { puntosGanados: 0, registrado: true, vecesRepetido };
    }
    if (input.investigacion) {
      const duplicate = await tx.queryObject<{ id: string }>(
        `SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'investigacion' AND metadata->>'sesionId' = $2 LIMIT 1`,
        [usuarioId, input.sesionId ?? ""],
      );
      if (duplicate.rowCount) return { puntosGanados: 0, registrado: false, vecesRepetido: 0 };
    } else if (!input.investigacion && input.sesionId) {
      const duplicate = await tx.queryObject<{ id: string }>(
        `SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND metadata->>'evento' = 'resumen_completado' AND metadata->>'sesionId' = $2 LIMIT 1`,
        [usuarioId, input.sesionId],
      );
      if (duplicate.rowCount) return { puntosGanados: 0, registrado: false, vecesRepetido: 0 };
    } else {
      const duplicate = await tx.queryObject<{ id: string }>(
        `SELECT id FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $6 AND paralelo = $7 AND metadata->>'evento' = $3
         AND metadata->>'contentId' = $4 AND COALESCE(metadata->>'formato','') = $5 LIMIT 1`,
        [usuarioId, fecha, metadata.evento, input.contentId, input.formato ?? "", perfil.cursoPeriodoId, perfil.paralelo],
      );
      if (duplicate.rowCount) return { puntosGanados: 0, registrado: false, vecesRepetido: 0 };
    }
    const otorgados = 0;
    await tx.queryObject(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata) VALUES ($1,$2,$3,$4,'leer_resumen',$5,$6,$7)`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, otorgados, input.investigacion ? "Investigación diaria" : "Resumen estudiado", JSON.stringify(metadata)],
    );
    return { puntosGanados: otorgados, registrado: true, vecesRepetido: 0 };
  });
  if (esProgresoTema) await getRedis().del(`gamificacion:tema-progreso:${usuarioId}:${input.temaRutaId}`);
  await getRedis().del(`gamificacion:resumen:${usuarioId}:${input.contentId}:${fecha}`);
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
      const rutaDuplicada = await query<{ existe: boolean }>(`SELECT EXISTS (SELECT 1 FROM puntos_individuales WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3 AND metadata->>'evento' = 'ruta_completada' AND metadata->>'contentId' = $4) AS existe`, [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, input.contentId]);
      if (!rutaDuplicada.rows[0]?.existe) {
        const hoy = await query<{ total: string }>(`SELECT COALESCE(SUM(GREATEST(puntos,0)),0) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]);
        const puntosRuta = Math.min(5, Math.max(0, gamificationConfig.puntosDiarios.maximo - Number(hoy.rows[0]?.total ?? 0)));
        await agregarPuntosIndividuales(usuarioId, fecha, "leer_resumen", puntosRuta, `Ruta completada: ${input.titulo ?? input.contentId}`, { evento: "ruta_completada", contentId: input.contentId });
        puntosRutaGanados = puntosRuta;
      }
      trofeosNuevos = await otorgarTrofeoDiario(usuarioId, "aprendiendo_sin_parar", { contentId: input.contentId });
    }
    const insigniaTema = await query<{ id: string }>(`SELECT id FROM insignias WHERE codigo = 'logro_tema_completo' AND activa = true LIMIT 1`);
    if (insigniaTema.rows[0]) insigniasNuevas = [await otorgarInsignia(usuarioId, insigniaTema.rows[0].id, { contentId: input.contentId, titulo: input.titulo ?? "" })];
  }
  const estadoDiario = await actualizarDesafiosDiarios(usuarioId, fecha);
  return { puntosGanados: puntosRutaGanados, trofeosNuevos, insigniasNuevas, desafiosDiarios: estadoDiario.desafios, bonoDesafios: estadoDiario.bonoNuevo ? gamificationConfig.puntosDiarios.bonoDesafios : 0, vecesRepetido: txResult.vecesRepetido };
}

export { calcularRankingParalelo as getRanking } from "./gamification.ranking.ts";
