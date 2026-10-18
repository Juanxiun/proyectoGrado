import { query, sTransaction } from "../connects/Database/transaction.ts";
import { withRetry } from "../connects/Database/reintento.ts";
import { HttpError, mapDbError } from "../utils/errors.ts";
import { asDateTimeString, serialize, toId } from "../utils/serialize.ts";
import { publicarEventoAsync } from "../utils/events.ts";
import {
  RachasDiarias,
  PuntosIndividuales,
  PuntosGlobales,
  Insignia,
  InsigniaEstudiante,
  Trofeo,
  TrofeoEstudiante,
  RecompensaTienda,
  CompraEstudiante,
  ActividadGamificada,
  RankingParalelo,
  RankingEstudiante,
  EstudianteGamificacion,
} from "../models/gamification.ts";
import { gamificationConfig } from "../config/gamification.config.ts";

// repo -> rachas diarias
async function getRacha(usuarioId: string): Promise<RachasDiarias | null> {
  const res = await query<RachasDiarias>(
    `SELECT * FROM rachas_diarias WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 1`,
    [usuarioId],
  );
  return res.rows[0] ?? null;
}

async function getRachaByFecha(usuarioId: string, fecha: string): Promise<RachasDiarias | null> {
  const res = await query<RachasDiarias>(
    `SELECT * FROM rachas_diarias WHERE usuario_id = $1 AND fecha = $2`,
    [usuarioId, fecha],
  );
  return res.rows[0] ?? null;
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
  const rachaAnterior = await getRacha(usuarioId);
  let rachaActual = rachaAnterior?.rachaActual ?? 0;
  let mejorRacha = rachaAnterior?.mejorRacha ?? 0;

  if (completada && porcentajeAcierto >= gamificationConfig.racha.umbralAcierto) {
    rachaActual = (rachaAnterior?.rachaActual ?? 0) + 1;
    if (rachaActual > mejorRacha) mejorRacha = rachaActual;
  } else if (!salvadaConPuntos) {
    rachaActual = 0;
  }

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
       RETURNING *`,
      [
        usuarioId,
        fecha,
        completada,
        aciertos,
        totalPreguntas,
        porcentajeAcierto,
        rachaActual,
        mejorRacha,
        salvadaConPuntos,
        puntosGastados,
      ],
    );
    return res.rows[0];
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
    const res = await query<PuntosIndividuales>(
      `INSERT INTO puntos_individuales (usuario_id, fecha, tipo, puntos, descripcion, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [usuarioId, fecha, tipo, puntos, descripcion, JSON.stringify(metadata ?? {})],
    );
    return res.rows[0];
  } catch (err) {
    throw mapDbError(err, "Error al agregar puntos individuales");
  }
}

async function getTotalPuntosIndividuales(usuarioId: string): Promise<number> {
  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(puntos), 0) AS total FROM puntos_individuales WHERE usuario_id = $1`,
    [usuarioId],
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
async function agregarPuntosGlobales(
  cursoPeriodoId: string,
  paralelo: "A" | "B",
  fecha: string,
  puntos: number,
  descripcion: string,
): Promise<PuntosGlobales> {
  try {
    const res = await query<PuntosGlobales>(
      `INSERT INTO puntos_globales (curso_periodo_id, paralelo, fecha, puntos_ganados, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cursoPeriodoId, paralelo, fecha, puntos, descripcion],
    );
    return res.rows[0];
  } catch (err) {
    throw mapDbError(err, "Error al agregar puntos globales");
  }
}

async function getPuntosGlobalesParalelo(cursoPeriodoId: string, paralelo: "A" | "B"): Promise<number> {
  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(puntos_ganados), 0) AS total FROM puntos_globales WHERE curso_periodo_id = $1 AND paralelo = $2`,
    [cursoPeriodoId, paralelo],
  );
  return Number(res.rows[0]?.total ?? 0);
}

// repo -> insignias
async function getInsigniasActivas(): Promise<Insignia[]> {
  const res = await query<Insignia>(`SELECT * FROM insignias WHERE activa = true`);
  return res.rows;
}

async function getInsigniasEstudiante(usuarioId: string): Promise<InsigniaEstudiante[]> {
  const res = await query<InsigniaEstudiante>(
    `SELECT * FROM insignias_estudiante WHERE usuario_id = $1`,
    [usuarioId],
  );
  return res.rows;
}

async function otorgarInsignia(usuarioId: string, insigniaId: string, metadata?: Record<string, unknown>): Promise<InsigniaEstudiante> {
  try {
    const res = await query<InsigniaEstudiante>(
      `INSERT INTO insignias_estudiante (usuario_id, insignia_id, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, insignia_id) DO NOTHING
       RETURNING *`,
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
  const res = await query<Trofeo>(`SELECT * FROM trofeos WHERE activo = true`);
  return res.rows;
}

async function getTrofeosEstudiante(usuarioId: string): Promise<TrofeoEstudiante[]> {
  const res = await query<TrofeoEstudiante>(
    `SELECT * FROM trofeos_estudiante WHERE usuario_id = $1`,
    [usuarioId],
  );
  return res.rows;
}

async function otorgarTrofeo(
  usuarioId: string,
  trofeoId: string,
  puntosOtorgados: number,
  metadata?: Record<string, unknown>,
): Promise<TrofeoEstudiante> {
  try {
    const res = await query<TrofeoEstudiante>(
      `INSERT INTO trofeos_estudiante (usuario_id, trofeo_id, puntos_otorgados, metadata)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (usuario_id, trofeo_id) DO NOTHING
       RETURNING *`,
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
    return res.rows[0] ?? { usuarioId, trofeoId, fechaObtencion: new Date().toISOString(), puntosOtorgados } as TrofeoEstudiante;
  } catch (err) {
    throw mapDbError(err, "Error al otorgar trofeo");
  }
}

// repo -> tienda recompensas
async function getRecompensasActivas(): Promise<RecompensaTienda[]> {
  const res = await query<RecompensaTienda>(`SELECT * FROM tienda_recompensas WHERE activa = true AND (stock IS NULL OR stock > 0)`);
  return res.rows;
}

async function comprarRecompensa(
  usuarioId: string,
  recompensaId: string,
): Promise<CompraEstudiante> {
  const recompensaRes = await query<RecompensaTienda>(`SELECT * FROM tienda_recompensas WHERE id = $1`, [recompensaId]);
  const recompensa = recompensaRes.rows[0];
  if (!recompensa) throw new HttpError(404, "Recompensa no encontrada");
  if (!recompensa.activa) throw new HttpError(400, "Recompensa no disponible");

  await gastarPuntosIndividuales(usuarioId, new Date().toISOString().split("T")[0], recompensa.costoPuntosIndividuales, "canje_tienda", `Compra: ${recompensa.nombre}`);

  try {
    const res = await query<CompraEstudiante>(
      `INSERT INTO compras_estudiante (usuario_id, recompensa_id, puntos_gastados)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [usuarioId, recompensaId, recompensa.costoPuntosIndividuales],
    );
    return res.rows[0];
  } catch (err) {
    throw mapDbError(err, "Error al comprar recompensa");
  }
}

// repo -> actividades gamificadas
async function registrarActividad(actividad: Omit<ActividadGamificada, "id" | "creadaEn">): Promise<ActividadGamificada> {
  try {
    const res = await query<ActividadGamificada>(
      `INSERT INTO actividades_gamificadas (
         usuario_id, estudiante_id, tipo, materia_id, materia_nombre, titulo,
         preguntas, respuestas, aciertos, total, porcentaje_acierto,
         tiempo_total_ms, puntos_ganados, puntos_calidad, puntos_tiempo, completada,
         fecha_inicio, fecha_fin
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        actividad.usuarioId,
        actividad.estudianteId,
        actividad.tipo,
        actividad.materiaId,
        actividad.materiaNombre,
        actividad.titulo,
        JSON.stringify(actividad.preguntas),
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
    return res.rows[0];
  } catch (err) {
    throw mapDbError(err, "Error al registrar actividad gamificada");
  }
}

async function getActividadesEstudiante(usuarioId: string, limite = 50): Promise<ActividadGamificada[]> {
  const res = await query<ActividadGamificada>(
    `SELECT * FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT $2`,
    [usuarioId, limite],
  );
  return res.rows;
}

// repo -> ranking estudiantes paralelo
async function calcularRankingParalelo(cursoPeriodoId: string): Promise<RankingParalelo[]> {
  const res = await query<{
    usuario_id: string;
    estudiante_id: string;
    nombre: string;
    apellido_paterno: string;
    avatar_url: string | null;
    paralelo: "A" | "B";
    racha_actual: number;
    mejor_racha: number;
    promedio_rendimiento: number;
    calidad_promedio: number;
    tiempo_promedio_ms: number;
    puntos_individuales: number;
    puntos_globales: number;
    insignias_count: number;
    trofeos_count: number;
  }>(`
    SELECT
      eg.usuario_id,
      eg.estudiante_id,
      eg.nombre,
      eg.apellido_paterno,
      eg.avatar_url,
      eg.paralelo,
      COALESCE(rd.racha_actual, 0) AS racha_actual,
      COALESCE(rd.mejor_racha, 0) AS mejor_racha,
      COALESCE(ap.promedio_rendimiento, 0) AS promedio_rendimiento,
      COALESCE(ap.calidad_promedio, 0) AS calidad_promedio,
      COALESCE(ap.tiempo_promedio_ms, 0) AS tiempo_promedio_ms,
      COALESCE(pi.total_puntos, 0) AS puntos_individuales,
      COALESCE(pg.total_puntos, 0) AS puntos_globales,
      COALESCE(ie.count, 0) AS insignias_count,
      COALESCE(te.count, 0) AS trofeos_count
    FROM estudiantes_gamificacion eg
    LEFT JOIN (
      SELECT usuario_id, racha_actual, mejor_racha
      FROM rachas_diarias rd1
      WHERE fecha = (SELECT MAX(fecha) FROM rachas_diarias WHERE usuario_id = rd1.usuario_id)
    ) rd ON rd.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id,
             AVG(porcentaje_acierto) AS promedio_rendimiento,
             AVG(CASE WHEN tiempo_total_ms > 0 THEN 1.0 ELSE 0.5 END) AS calidad_promedio,
             AVG(tiempo_total_ms) AS tiempo_promedio_ms
      FROM actividades_gamificadas
      WHERE completada = true
      GROUP BY usuario_id
    ) ap ON ap.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, SUM(puntos) AS total_puntos FROM puntos_individuales GROUP BY usuario_id
    ) pi ON pi.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT curso_periodo_id, paralelo, SUM(puntos_ganados) AS total_puntos
      FROM puntos_globales
      GROUP BY curso_periodo_id, paralelo
    ) pg ON pg.curso_periodo_id = eg.curso_periodo_id AND pg.paralelo = eg.paralelo
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM insignias_estudiante GROUP BY usuario_id
    ) ie ON ie.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM trofeos_estudiante GROUP BY usuario_id
    ) te ON te.usuario_id = eg.usuario_id
    WHERE eg.curso_periodo_id = $1 AND eg.estado = 'activo'
    ORDER BY
      rd.racha_actual DESC,
      ap.promedio_rendimiento DESC,
      ap.calidad_promedio DESC,
      ap.tiempo_promedio_ms ASC
  `, [cursoPeriodoId]);

  const paralelos = ["A", "B"] as const;
  return paralelos.map((paralelo, idx) => {
    const estudiantes = res.rows
      .filter((r) => r.paralelo === paralelo)
      .map((r, i) => ({
        usuarioId: r.usuario_id,
        estudianteId: r.estudiante_id,
        nombre: r.nombre,
        apellidoPaterno: r.apellido_paterno,
        avatarUrl: r.avatar_url,
        rachaActual: r.racha_actual,
        mejorRacha: r.mejor_racha,
        promedioRendimiento: Number(r.promedio_rendimiento.toFixed(2)),
        calidadPromedio: Number(r.calidad_promedio.toFixed(2)),
        tiempoPromedioMs: r.tiempo_promedio_ms,
        puntosIndividuales: r.puntos_individuales,
        puntosGlobales: r.puntos_globales,
        insigniasCount: r.insignias_count,
        trofeosCount: r.trofeos_count,
        posicion: i + 1,
      }));
    return { paralelo, cursoPeriodoId, estudiantes, actualizadaEn: new Date().toISOString() };
  });
}

// service -> logica principal
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
  mediaTiempoOtrosMs?: number; // Para gamificación: tiempo promedio de otros estudiantes
  intentoAnterior?: { puntuacion: number; fecha: string } | null; // Para insignia de mejora
}): Promise<{
  actividad: ActividadGamificada;
  racha: RachasDiarias;
  puntosGanados: number;
  puntuacion: number; // Nueva puntuación 2-10
  insigniasNuevas: InsigniaEstudiante[];
  trofeosNuevos: TrofeoEstudiante[];
}> {
  const fecha = new Date().toISOString().split("T")[0];
  const { aciertos, total, porcentajeAcierto, puntosGanados, puntosCalidad, puntosTiempo } = calcularPuntos(
    input.respuestas,
    input.preguntas,
    input.tiempoTotalMs,
  );

  const completada = aciertos === total;
  const rachaCompletada = completada && porcentajeAcierto >= gamificationConfig.racha.umbralAcierto;
  
  // Nueva puntuación 2-10 para gamificación
  const mediaTiempoOtros = input.mediaTiempoOtrosMs ?? 0;
  const puntuacion = calcularPuntuacion(aciertos, total, input.tiempoTotalMs, mediaTiempoOtros);

  // transaccion -> procesar actividad completada
  return await sTransaction(async (_tx) => {
    await upsertEstudianteGamificacion({
      usuarioId: input.usuarioId,
      estudianteId: input.estudianteId,
      cursoPeriodoId: input.cursoPeriodoId,
      paralelo: input.paralelo,
    });

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
      rachaCompletada,
      aciertos,
      total,
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

    if (rachaCompletada) {
      const puntosGlobales = Math.floor(Math.random() * 3) + 3;
      await agregarPuntosGlobales(input.cursoPeriodoId, input.paralelo, fecha, puntosGlobales, `Racha completada: ${actividad.titulo}`);
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

    return { actividad, racha, puntosGanados, puntuacion, insigniasNuevas, trofeosNuevos };
  });
}

function calcularPuntos(
  respuestas: ActividadGamificada["respuestas"],
  preguntas: ActividadGamificada["preguntas"],
  tiempoTotalMs: number,
) {
  let aciertos = 0;
  let puntosCalidad = 0;
  let puntosTiempo = 0;

  const preguntaMap = new Map(preguntas.map((p) => [p.id, p]));

  for (const r of respuestas) {
    if (r.correcta) {
      aciertos++;
      const pregunta = preguntaMap.get(r.preguntaId);
      const base = pregunta?.puntosBase ?? 5;
      // calidad: si respondio rapido y bien
      const tiempoPregunta = r.tiempoMs;
      const tiempoLimite = pregunta?.tiempoLimiteMs ?? 60000;
      const factorTiempo = Math.max(0.5, 1 - tiempoPregunta / tiempoLimite);
      puntosCalidad += Math.round(base * 0.6);
      puntosTiempo += Math.round(base * 0.4 * factorTiempo);
    }
  }

  const total = preguntas.length;
  const porcentajeAcierto = total > 0 ? aciertos / total : 0;
  const puntosGanados = aciertos * 5 + puntosCalidad + puntosTiempo;

  return { aciertos, total, porcentajeAcierto, puntosGanados, puntosCalidad, puntosTiempo };
}

// gamificacion -> puntos 2-10
export function calcularPuntuacion(
  aciertos: number,
  total: number,
  tiempoMs: number,
  mediaTiempoOtros: number,
): number {
  if (total === 0) return 2;
  const porcentaje = aciertos / total;
  let puntuacion = 2; // mínimo 2
  
  // Base por aciertos (2-6 puntos)
  if (porcentaje >= 0.9) puntuacion += 4;
  else if (porcentaje >= 0.7) puntuacion += 3;
  else if (porcentaje >= 0.5) puntuacion += 2;
  else if (porcentaje >= 0.3) puntuacion += 1;
  
  // Bonus por velocidad relativa (0-2 puntos)
  if (tiempoMs > 0 && mediaTiempoOtros > 0) {
    const ratio = tiempoMs / mediaTiempoOtros;
    if (ratio <= 0.5) puntuacion += 2;
    else if (ratio <= 0.75) puntuacion += 1;
  }
  
  // Bonus por perfección (0-2 puntos)
  if (aciertos === total) puntuacion += 2;
  
  return Math.min(10, Math.max(2, puntuacion));
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
        if (contexto.tiempoTotalMs < 30000 && contexto.aciertos === contexto.total) cumple = true;
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
  const fecha = new Date().toISOString().split("T")[0];
  const racha = await getRachaByFecha(usuarioId, fecha);
  if (!racha || racha.completada) {
    throw new HttpError(400, "No hay racha para salvar o ya completada");
  }
  const costo = gamificationConfig.racha.costoSalvarRacha;
  await gastarPuntosIndividuales(usuarioId, fecha, costo, "salvar_racha", "Salvar racha diaria");
  return await crearOActualizarRacha(usuarioId, fecha, true, 0, 0, true, costo);
}

export async function usarPistaExamen(usuarioId: string): Promise<void> {
  const fecha = new Date().toISOString().split("T")[0];
  const costo = gamificationConfig.pistas.costo;
  await gastarPuntosIndividuales(usuarioId, fecha, costo, "pista_examen", "Pista en examen");
}

// service -> resumen gamificacion estudiante
export async function getResumenEstudiante(usuarioId: string): Promise<{
  racha: RachasDiarias | null;
  puntosIndividuales: number;
  puntosGlobales: number;
  insignias: InsigniaEstudiante[];
  trofeos: TrofeoEstudiante[];
  ranking: RankingEstudiante | null;
}> {
  const infoEst = await getInfoEstudianteGamificacion(usuarioId);
  const [racha, totalIndividuales, totalGlobales, insignias, trofeos] = await Promise.all([
    getRacha(usuarioId),
    getTotalPuntosIndividuales(usuarioId),
    infoEst ? getPuntosGlobalesParalelo(infoEst.cursoPeriodoId, infoEst.paralelo) : Promise.resolve(0),
    getInsigniasEstudiante(usuarioId),
    getTrofeosEstudiante(usuarioId),
  ]);

  return {
    racha,
    puntosIndividuales: totalIndividuales,
    puntosGlobales: totalGlobales,
    insignias,
    trofeos,
    ranking: null,
  };
}

export async function getTienda(): Promise<RecompensaTienda[]> {
  return getRecompensasActivas();
}

export async function canjearRecompensa(usuarioId: string, recompensaId: string): Promise<CompraEstudiante> {
  return comprarRecompensa(usuarioId, recompensaId);
}

export async function getRanking(cursoPeriodoId: string): Promise<RankingParalelo[]> {
  return calcularRankingParalelo(cursoPeriodoId);
}

// repo -> info estudiante gamificacion
export async function getInfoEstudianteGamificacion(usuarioId: string): Promise<EstudianteGamificacion | null> {
  const res = await query<{
    estudiante_id: string;
    usuario_id: string;
    curso_periodo_id: string;
    paralelo: "A" | "B";
    nombre: string;
    apellido_paterno: string;
    avatar_url: string | null;
  }>(
    `SELECT estudiante_id, usuario_id, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url
     FROM estudiantes_gamificacion
     WHERE usuario_id = $1 AND estado = 'activo'
     LIMIT 1`,
    [usuarioId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    estudianteId: String(row.estudiante_id),
    usuarioId: String(row.usuario_id),
    cursoPeriodoId: String(row.curso_periodo_id),
    paralelo: row.paralelo,
    nombre: row.nombre,
    apellidoPaterno: row.apellido_paterno,
    avatarUrl: row.avatar_url,
  };
}

// repo -> guardar estudiante gamificacion
export async function upsertEstudianteGamificacion(data: {
  usuarioId: string;
  estudianteId: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
  nombre?: string;
  apellidoPaterno?: string;
  avatarUrl?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO estudiantes_gamificacion (
       usuario_id, estudiante_id, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url, estado
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
     ON CONFLICT (usuario_id) DO UPDATE SET
       estudiante_id = EXCLUDED.estudiante_id,
       curso_periodo_id = EXCLUDED.curso_periodo_id,
       paralelo = EXCLUDED.paralelo,
       nombre = CASE WHEN EXCLUDED.nombre <> '' THEN EXCLUDED.nombre ELSE estudiantes_gamificacion.nombre END,
       apellido_paterno = CASE WHEN EXCLUDED.apellido_paterno <> '' THEN EXCLUDED.apellido_paterno ELSE estudiantes_gamificacion.apellido_paterno END,
       avatar_url = COALESCE(EXCLUDED.avatar_url, estudiantes_gamificacion.avatar_url),
       estado = 'activo',
       fecha_actualizacion = NOW()`,
    [
      data.usuarioId,
      data.estudianteId,
      data.cursoPeriodoId,
      data.paralelo,
      data.nombre ?? "",
      data.apellidoPaterno ?? "",
      data.avatarUrl ?? null,
    ],
  );
}