import { query } from "../../connects/Database/transaction.ts";
import { HttpError, mapDbError } from "../../utils/errors.ts";
import { toNumber } from "../../utils/serialize.ts";
import { publicarEventoAsync } from "../../utils/events.ts";
import type {
  ActividadGamificada,
  Insignia,
  InsigniaEstudiante,
  PuntosIndividuales,
  RachasDiarias,
  Trofeo,
  TrofeoEstudiante,
} from "../../models/gamification.ts";
import { gamificationConfig } from "../../config/gamification.config.ts";
import { diaAnterior, fechaLocal, inicioSemana } from "../gamification.calculo.ts";
import { getInfoEstudianteGamificacion } from "../gamification.estudiantes.ts";

// gamificacion -> normalizacion de filas numericas
function normalizarRacha(row: RachasDiarias | undefined): RachasDiarias | null {
  return row ? { ...row, porcentajeAcierto: toNumber(row.porcentajeAcierto) } : null;
}

function normalizarActividad(row: ActividadGamificada): ActividadGamificada {
  return { ...row, porcentajeAcierto: toNumber(row.porcentajeAcierto) };
}

// gamificacion -> consulta y persistencia de rachas diarias
export async function getRacha(usuarioId: string): Promise<RachasDiarias | null> {
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

export async function getRachaByFecha(usuarioId: string, fecha: string): Promise<RachasDiarias | null> {
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

export async function crearOActualizarRacha(
  usuarioId: string,
  fecha: string,
  completada: boolean,
  aciertos: number,
  totalPreguntas: number,
  salvadaConPuntos = false,
  puntosGastados = 0,
): Promise<RachasDiarias> {
  const porcentajeAcierto = totalPreguntas > 0 ? aciertos / totalPreguntas : 0;
  const [rachaDeHoy, rachaAnterior, rachaDeAyer] = await Promise.all([
    getRachaByFecha(usuarioId, fecha),
    getRacha(usuarioId),
    getRachaByFecha(usuarioId, diaAnterior(fecha)),
  ]);
  const mejorRacha = Math.max(rachaDeHoy?.mejorRacha ?? 0, rachaAnterior?.mejorRacha ?? 0);
  const cumpleUmbral = completada && (totalPreguntas === 0 || porcentajeAcierto >= gamificationConfig.racha.umbralAcierto);
  const yaCompletoHoy = Boolean(rachaDeHoy?.completada && !rachaDeHoy.salvadaConPuntos);
  const rachaBase = rachaDeAyer?.completada ? rachaDeAyer.rachaActual : 0;
  const completarHoy = cumpleUmbral || Boolean(rachaDeHoy?.completada) || salvadaConPuntos;
  const mejorIntento = rachaDeHoy && rachaDeHoy.porcentajeAcierto > porcentajeAcierto
    ? { aciertos: rachaDeHoy.aciertos, total: rachaDeHoy.totalPreguntas, porcentaje: rachaDeHoy.porcentajeAcierto }
    : { aciertos, total: totalPreguntas, porcentaje: porcentajeAcierto };
  const rachaActual = cumpleUmbral
    ? (yaCompletoHoy ? rachaDeHoy!.rachaActual : rachaBase + 1)
    : (rachaDeHoy?.rachaActual ?? rachaBase);
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
        mejorIntento.aciertos,
        mejorIntento.total,
        mejorIntento.porcentaje,
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

// gamificacion -> gestion de puntos individuales
export async function agregarPuntosIndividuales(
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

export async function getTotalPuntosIndividuales(usuarioId: string): Promise<number> {
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) return 0;
  const res = await query<{ total: string }>(
    `SELECT COALESCE(SUM(puntos), 0) AS total FROM puntos_individuales
     WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3`,
    [usuarioId, perfil.cursoPeriodoId, perfil.paralelo],
  );
  return Number(res.rows[0]?.total ?? 0);
}

export async function gastarPuntosIndividuales(
  usuarioId: string,
  fecha: string,
  puntos: number,
  tipo: PuntosIndividuales["tipo"],
  descripcion: string,
): Promise<void> {
  const total = await getTotalPuntosIndividuales(usuarioId);
  if (total < puntos) throw new HttpError(400, "Puntos insuficientes");
  await agregarPuntosIndividuales(usuarioId, fecha, tipo, -puntos, descripcion);
}

// gamificacion -> insignias y trofeos
export async function getInsigniasActivas(): Promise<Insignia[]> {
  const res = await query<Insignia>(
    `SELECT id, codigo, nombre, descripcion, icono_url AS "iconoUrl", criterio, activa
     FROM insignias WHERE activa = true`,
  );
  return res.rows;
}

export async function getInsigniasEstudiante(usuarioId: string): Promise<InsigniaEstudiante[]> {
  const res = await query<InsigniaEstudiante>(
    `SELECT ie.id, ie.usuario_id AS "usuarioId", ie.insignia_id AS "insigniaId",
            ie.fecha_obtencion AS "fechaObtencion", ie.metadata, i.codigo, i.nombre
     FROM insignias_estudiante ie JOIN insignias i ON i.id = ie.insignia_id
     WHERE ie.usuario_id = $1`,
    [usuarioId],
  );
  return res.rows;
}

export async function otorgarInsignia(
  usuarioId: string,
  insigniaId: string,
  metadata?: Record<string, unknown>,
): Promise<InsigniaEstudiante> {
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

export async function getTrofeosActivos(): Promise<Trofeo[]> {
  const res = await query<Trofeo>(
    `SELECT id, codigo, nombre, descripcion, icono_url AS "iconoUrl", puntos, criterio, periodo, activo
     FROM trofeos WHERE activo = true`,
  );
  return res.rows;
}

export async function getTrofeosEstudiante(usuarioId: string): Promise<TrofeoEstudiante[]> {
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

export async function otorgarTrofeo(
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

export async function otorgarTrofeoDiario(
  usuarioId: string,
  codigo: string,
  metadata: Record<string, unknown> = {},
): Promise<TrofeoEstudiante[]> {
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

// gamificacion -> registro de actividades y desafios diarios
export async function registrarActividad(
  actividad: Omit<ActividadGamificada, "id" | "creadaEn">,
): Promise<ActividadGamificada> {
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

export async function actualizarDesafiosDiarios(usuarioId: string, fecha = fechaLocal()): Promise<{
  desafios: Array<{ codigo: string; nombre: string; completado: boolean }>;
  bonoOtorgado: boolean;
  bonoNuevo: boolean;
}> {
  const perfil = await getInfoEstudianteGamificacion(usuarioId);
  if (!perfil) return { desafios: [], bonoOtorgado: false, bonoNuevo: false };

  const semana = inicioSemana(fecha);
  const [actividad, resumen, puntos, diasActivos] = await Promise.all([
    query<{ total: string }>(`SELECT COUNT(*) AS total FROM actividades_gamificadas WHERE usuario_id = $1 AND curso_periodo_id = $3 AND paralelo = $4 AND completada = true AND (fecha_inicio AT TIME ZONE 'America/La_Paz')::date = $2`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ formatos: string[]; total: string }>(`SELECT COALESCE(ARRAY_AGG(DISTINCT metadata->>'formato') FILTER (WHERE metadata->>'evento' IN ('resumen_completado', 'tema_completado')), ARRAY[]::text[]) AS formatos, COUNT(*) FILTER (WHERE metadata->>'evento' IN ('resumen_completado', 'tema_completado')) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ total: string }>(`SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ total: string }>(`SELECT COUNT(*) AS total FROM rachas_diarias WHERE usuario_id = $1 AND completada = true AND fecha >= $2::date AND fecha <= $3::date`, [usuarioId, semana, fecha]),
  ]);

  const formatos = resumen.rows[0]?.formatos ?? [];
  const puntosBase = Number(puntos.rows[0]?.total ?? 0);
  const desafios = [
    { codigo: "resumen", nombre: "Complete un tema o su resumen.", completado: Number(resumen.rows[0]?.total ?? 0) > 0 },
    { codigo: "actividad", nombre: "Realice una actividad.", completado: Number(actividad.rows[0]?.total ?? 0) > 0 },
    { codigo: "puntos", nombre: `Consiga ${gamificationConfig.puntosDiarios.maximo} puntos en el día.`, completado: puntosBase >= gamificationConfig.puntosDiarios.maximo },
    { codigo: "cartas", nombre: "Complete un tema o resumen en Cartas.", completado: formatos.includes("CARTAS_EXPLICATIVAS") },
    { codigo: "esquema", nombre: "Complete el resumen en Esquema.", completado: formatos.includes("ESQUEMA_GEMMA") },
  ];

  let bonoOtorgado = false;
  let bonoNuevo = false;
  if (Number(diasActivos.rows[0]?.total ?? 0) >= 5) {
    const restantes = Math.max(0, gamificationConfig.puntosDiarios.maximo - puntosBase);
    const result = await query<{ id: string }>(
      `INSERT INTO puntos_individuales (usuario_id, curso_periodo_id, paralelo, fecha, tipo, puntos, descripcion, metadata)
       VALUES ($1,$2,$3,$4,'ajuste_manual',$5,'Bono semanal por cinco días de estudio',$6::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, fecha, Math.min(gamificationConfig.puntosDiarios.bonoDesafios, restantes), JSON.stringify({ evento: "bono_desafios_semanales", semana })],
    );
    bonoNuevo = result.rowCount > 0;
    bonoOtorgado = bonoNuevo || Number(
      (await query<{ total: string }>(`SELECT COUNT(*) AS total FROM puntos_individuales WHERE usuario_id = $1 AND curso_periodo_id = $2 AND paralelo = $3 AND metadata->>'evento' = 'bono_desafios_semanales' AND metadata->>'semana' = $4`, [usuarioId, perfil.cursoPeriodoId, perfil.paralelo, semana])).rows[0]?.total ?? 0,
    ) > 0;
  }
  return { desafios, bonoOtorgado, bonoNuevo };
}
