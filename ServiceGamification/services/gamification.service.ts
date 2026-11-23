import { query, sTransaction } from "../connects/Database/transaction.ts";
import { HttpError } from "../utils/errors.ts";
import { asDateTimeString } from "../utils/serialize.ts";
import type {
  ActividadGamificada,
  InsigniaEstudiante,
  RachasDiarias,
  RankingEstudiante,
  TrofeoEstudiante,
} from "../models/gamification.ts";
import { gamificationConfig } from "../config/gamification.config.ts";
import { calcularProgresion, calcularPuntos, calcularPuntuacion, fechaLocal } from "./gamification.calculo.ts";
import { getInfoEstudianteGamificacion, upsertEstudianteGamificacion } from "./gamification.estudiantes.ts";
import {
  actualizarDesafiosDiarios,
  agregarPuntosIndividuales,
  crearOActualizarRacha,
  gastarPuntosIndividuales,
  getInsigniasEstudiante,
  getRacha,
  getRachaByFecha,
  getTotalPuntosIndividuales,
  getTrofeosEstudiante,
  otorgarTrofeoDiario,
  registrarActividad,
} from "./gamification/repository.ts";
import { evaluarInsignias, evaluarTrofeos, otorgarInsigniaDinamica } from "./gamification/rewards.ts";

export { calcularProgresion, calcularPuntos, calcularPuntuacion, diaAnterior, fechaLocal, inicioSemana } from "./gamification.calculo.ts";
export { getInfoEstudianteGamificacion, requerirPerfil, upsertEstudianteGamificacion } from "./gamification.estudiantes.ts";
export { getEvidenciaAprendizaje } from "./gamification.evidencia.ts";
export { canjearRecompensa, getTienda } from "./gamification.tienda.ts";
export { calcularRankingParalelo as getRanking } from "./gamification.ranking.ts";
export { otorgarInsigniaDinamica } from "./gamification/rewards.ts";
export { registrarProgresoEstudio } from "./gamification/estudio.ts";

// gamificacion -> procesamiento transaccional de actividad completada
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
  mediaTiempoOtrosMs?: number;
  intentoAnterior?: { puntuacion: number; fecha: string } | null;
}): Promise<{
  actividad: ActividadGamificada;
  racha: RachasDiarias;
  puntosGanados: number;
  bonusSpeedrun: number;
  speedrun: boolean;
  puntuacion: number;
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
  const speedrun = total >= 5 && porcentajeAcierto >= 0.8 && input.tiempoTotalMs > 0 && input.tiempoTotalMs <= 30000;
  const mediaTiempoOtros = input.mediaTiempoOtrosMs ?? 0;
  const puntuacion = calcularPuntuacion(aciertos, total, input.tiempoTotalMs, mediaTiempoOtros);

  const resultado = await sTransaction(async (tx) => {
    await tx.queryObject(`SELECT pg_advisory_xact_lock($1::bigint)`, [input.usuarioId]);
    await upsertEstudianteGamificacion({
      usuarioId: input.usuarioId,
      estudianteId: input.estudianteId,
      cursoPeriodoId: input.cursoPeriodoId,
      paralelo: input.paralelo,
    });

    const [puntosHoyRes, dobleDisponible] = await Promise.all([
      query<{ total: string }>(
        `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
         WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`,
        [input.usuarioId, fecha, input.cursoPeriodoId, input.paralelo],
      ),
      query<{ id: string }>(
        `UPDATE compras_estudiante ce SET usada = true, fecha_uso = NOW()
         WHERE ce.id = (
           SELECT ce2.id FROM compras_estudiante ce2
           JOIN tienda_recompensas tr ON tr.id = ce2.recompensa_id
           WHERE ce2.usuario_id = $1 AND ce2.curso_periodo_id = $3 AND ce2.paralelo = $4 AND ce2.usada = false AND lower(tr.nombre) = 'multiplicadores de puntos'
           ORDER BY ce2.fecha_compra LIMIT 1
         ) AND $2 = true RETURNING ce.id`,
        [input.usuarioId, completada, input.cursoPeriodoId, input.paralelo],
      ),
    ]);

    const puntosHoy = Number(puntosHoyRes.rows[0]?.total ?? 0);
    const mult = dobleDisponible.rowCount > 0 ? 2 : 1;
    const puntosBaseActividad = completada ? Math.min(10, Math.max(5, puntosCalculados)) : 0;
    const puntosConBonificacion = puntosBaseActividad * mult + (speedrun ? 2 : 0);
    const cupoRestante = Math.max(0, gamificationConfig.puntosDiarios.maximo - puntosHoy);
    const puntosGanados = Math.max(0, Math.min(puntosConBonificacion, cupoRestante));
    const bonusSpeedrun = speedrun ? Math.min(2, Math.max(0, puntosGanados - Math.min(puntosBaseActividad * mult, cupoRestante))) : 0;

    const actividad = await registrarActividad({
      ...input,
      aciertos,
      total,
      porcentajeAcierto,
      puntosGanados,
      puntosCalidad,
      puntosTiempo,
      completada,
    });

    const racha = await crearOActualizarRacha(input.usuarioId, fecha, puntosHoy + puntosGanados >= 10, 0, 0, false, 0);

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

    const [insigniasTradicionales, insigniasDinamicas, trofeosNuevos] = await Promise.all([
      evaluarInsignias(input.usuarioId, input.estudianteId, {
        actividad,
        racha,
        puntosGanados,
        aciertos,
        total,
        tiempoTotalMs: input.tiempoTotalMs,
      }),
      otorgarInsigniaDinamica(input.usuarioId, puntuacion, input.tiempoTotalMs, mediaTiempoOtros, input.intentoAnterior ?? null),
      evaluarTrofeos(input.usuarioId, input.cursoPeriodoId, input.paralelo),
    ]);

    if (speedrun) {
      trofeosNuevos.push(...await otorgarTrofeoDiario(input.usuarioId, "speedrunner", { actividadId: actividad.id }));
    }

    return {
      actividad,
      racha,
      puntosGanados,
      bonusSpeedrun,
      speedrun,
      puntuacion,
      insigniasNuevas: [...insigniasTradicionales, ...insigniasDinamicas],
      trofeosNuevos,
    };
  });

  const estadoDiario = await actualizarDesafiosDiarios(input.usuarioId, fecha);
  return { ...resultado, bonoDesafios: estadoDiario.bonoNuevo ? gamificationConfig.puntosDiarios.bonoDesafios : 0 };
}

// gamificacion -> uso de salvador de racha y pistas
export async function salvarRachaConPuntos(usuarioId: string): Promise<RachasDiarias> {
  const fecha = fechaLocal();
  const [perfil, racha] = await Promise.all([
    getInfoEstudianteGamificacion(usuarioId),
    getRachaByFecha(usuarioId, fecha),
  ]);
  if (!perfil) throw new HttpError(409, "Primero debes inicializar tu perfil de gamificación");
  if (!racha || racha.completada) throw new HttpError(400, "No hay racha para salvar o ya completada");

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
  return crearOActualizarRacha(usuarioId, fecha, true, 0, 0, true, costo);
}

export async function usarPistaExamen(usuarioId: string): Promise<void> {
  await gastarPuntosIndividuales(usuarioId, fechaLocal(), gamificationConfig.pistas.costo, "pista_examen", "Pista en examen");
}

// gamificacion -> resumen consolidado del estudiante
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
  const fecha = fechaLocal();
  const [infoEst, estadoDiario] = await Promise.all([
    getInfoEstudianteGamificacion(usuarioId),
    actualizarDesafiosDiarios(usuarioId, fecha),
  ]);

  const [ultimaRacha, totalIndividuales, puntosGanadosCurso, insignias, trofeos, puntosHoyRes, actividadesHoyRes] = await Promise.all([
    getRacha(usuarioId),
    getTotalPuntosIndividuales(usuarioId),
    infoEst
      ? query<{ total: string }>(
        `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
         WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3`,
        [usuarioId, infoEst.cursoPeriodoId, infoEst.paralelo],
      ).then((res) => Number(res.rows[0]?.total ?? 0))
      : Promise.resolve(0),
    getInsigniasEstudiante(usuarioId),
    getTrofeosEstudiante(usuarioId),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales
       WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`,
      [usuarioId, fecha, infoEst?.cursoPeriodoId ?? "", infoEst?.paralelo ?? ""],
    ),
    query<{ titulo: string; materia_nombre: string; porcentaje_acierto: number; aciertos: number; total: number; fecha_fin: string | null; feedback: string | null; tipo_registro: string }>(
      `SELECT titulo, materia_nombre, porcentaje_acierto, aciertos, total, fecha_fin, feedback, tipo_registro FROM (
         SELECT titulo, materia_nombre, porcentaje_acierto, aciertos, total, fecha_fin AS fecha_fin, respuestas->0->>'feedback' AS feedback, fecha_inicio AS orden, 'actividad'::text AS tipo_registro
         FROM actividades_gamificadas
         WHERE usuario_id = $1 AND (fecha_inicio AT TIME ZONE 'America/La_Paz')::date = $2
         UNION ALL
         SELECT CASE WHEN metadata->>'evento' = 'investigacion' THEN 'Investigación diaria: ' || COALESCE(metadata->>'titulo', 'tema') WHEN metadata->>'evento' = 'tema_completado' THEN 'Tema completado: ' || COALESCE(metadata->>'tituloTema', metadata->>'titulo', 'tema') ELSE COALESCE(metadata->>'titulo', 'Resumen ' || COALESCE(metadata->>'formato', 'estudiado')) END,
                COALESCE(metadata->>'materiaNombre', 'Estudio personal'), 0.0, 0, 0, creada_en, NULL::text, creada_en, metadata->>'evento'
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
      tipo: item.tipo_registro,
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
