import { query, sTransaction } from "../connects/Database/transaction.ts";
import { withRetry } from "../connects/Database/reintento.ts";
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
  RecompensaTienda,
  CompraEstudiante,
  ActividadGamificada,
  RankingParalelo,
  RankingEstudiante,
  EstudianteGamificacion,
} from "../models/gamification.ts";
import { gamificationConfig } from "../config/gamification.config.ts";
import { getRedis } from "../connects/Redis/redis.ts";

// fecha -> dia local de gamificacion
function fechaLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// fecha -> dia local anterior
function diaAnterior(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day - 1));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

// nivel -> calcular rango y progreso del curso actual
function calcularProgresion(puntosCurso: number): { nivel: number; rango: "D" | "C" | "B" | "A" | "S"; puntosSiguienteNivel: number } {
  const nivel = Math.min(gamificationConfig.progresion.nivelMaximo, Math.floor(Math.max(0, puntosCurso) / gamificationConfig.progresion.puntosPorNivel));
  const rango = nivel < 10 ? "D" : nivel < 20 ? "C" : nivel < 45 ? "B" : nivel < 60 ? "A" : "S";
  return { nivel, rango, puntosSiguienteNivel: nivel >= gamificationConfig.progresion.nivelMaximo ? 0 : gamificationConfig.progresion.puntosPorNivel - (Math.max(0, puntosCurso) % gamificationConfig.progresion.puntosPorNivel) };
}

// fecha -> lunes local de la semana
function inicioSemana(fecha: string): string {
  const [year, month, day] = fecha.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

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

// repo -> ranking estudiantes paralelo
async function calcularRankingParalelo(cursoPeriodoId: string): Promise<RankingParalelo[]> {
  const res = await query<{
    usuario_id: string;
    estudiante_id: string;
    tag: string;
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
    insignias_count: number;
    trofeos_count: number;
  }>(`
    SELECT
      eg.usuario_id,
      eg.estudiante_id,
      eg.tag,
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
      COALESCE(ie.count, 0) AS insignias_count,
      COALESCE(te.count, 0) AS trofeos_count
    FROM estudiantes_gamificacion eg
    LEFT JOIN (
      SELECT usuario_id, racha_actual, mejor_racha
      FROM rachas_diarias rd1
      WHERE fecha = (SELECT MAX(fecha) FROM rachas_diarias WHERE usuario_id = rd1.usuario_id)
    ) rd ON rd.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, paralelo,
             AVG(porcentaje_acierto) AS promedio_rendimiento,
             AVG(CASE WHEN tiempo_total_ms > 0 THEN 1.0 ELSE 0.5 END) AS calidad_promedio,
             AVG(tiempo_total_ms) AS tiempo_promedio_ms
      FROM actividades_gamificadas
      WHERE completada = true AND curso_periodo_id = $1
      GROUP BY usuario_id, paralelo
    ) ap ON ap.usuario_id = eg.usuario_id AND ap.paralelo = eg.paralelo
    LEFT JOIN (
      SELECT usuario_id, paralelo,
             SUM(GREATEST(puntos, 0)) AS total_puntos
      FROM puntos_individuales
      WHERE curso_periodo_id = $1
      GROUP BY usuario_id, paralelo
    ) pi ON pi.usuario_id = eg.usuario_id AND pi.paralelo = eg.paralelo
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM insignias_estudiante GROUP BY usuario_id
    ) ie ON ie.usuario_id = eg.usuario_id
    LEFT JOIN (
      SELECT usuario_id, COUNT(*) AS count FROM trofeos_estudiante GROUP BY usuario_id
    ) te ON te.usuario_id = eg.usuario_id
    WHERE eg.curso_periodo_id = $1 AND eg.estado = 'activo'
    ORDER BY
      pi.total_puntos DESC,
      ap.promedio_rendimiento DESC,
      ap.calidad_promedio DESC,
      ap.tiempo_promedio_ms ASC
  `, [cursoPeriodoId]);

  const paralelos = ["A", "B"] as const;
  return paralelos.map((paralelo) => {
    const estudiantes = res.rows
      .filter((r) => r.paralelo === paralelo)
      .map((r, i) => ({
        usuarioId: String(r.usuario_id),
        estudianteId: String(r.estudiante_id),
        tag: r.tag,
        nombre: r.nombre,
        apellidoPaterno: r.apellido_paterno,
        avatarUrl: r.avatar_url,
        rachaActual: Number(r.racha_actual ?? 0),
        mejorRacha: Number(r.mejor_racha ?? 0),
        promedioRendimiento: Number(Number(r.promedio_rendimiento ?? 0).toFixed(2)),
        calidadPromedio: Number(Number(r.calidad_promedio ?? 0).toFixed(2)),
        tiempoPromedioMs: Number(r.tiempo_promedio_ms ?? 0),
        puntosIndividuales: Number(r.puntos_individuales ?? 0),
        ...calcularProgresion(Number(r.puntos_individuales ?? 0)),
        insigniasCount: Number(r.insignias_count ?? 0),
        trofeosCount: Number(r.trofeos_count ?? 0),
        posicion: i + 1,
      }));
    return { paralelo, cursoPeriodoId, estudiantes, actualizadaEn: new Date().toISOString() };
  });
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
    query<{ formatos: string[]; total: string }>(`SELECT COALESCE(ARRAY_AGG(DISTINCT metadata->>'formato') FILTER (WHERE metadata->>'evento' = 'resumen_completado'), ARRAY[]::text[]) AS formatos, COUNT(*) FILTER (WHERE metadata->>'evento' = 'resumen_completado') AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
    query<{ total: string }>(`SELECT COALESCE(SUM(GREATEST(puntos, 0)), 0) AS total FROM puntos_individuales WHERE usuario_id = $1 AND fecha = $2 AND curso_periodo_id = $3 AND paralelo = $4`, [usuarioId, fecha, perfil.cursoPeriodoId, perfil.paralelo]),
  ]);
  const formatos = resumen.rows[0]?.formatos ?? [];
  const hayActividad = Number(actividad.rows[0]?.total ?? 0) > 0;
  const hayResumen = Number(resumen.rows[0]?.total ?? 0) > 0;
  const puntosBase = Number(puntos.rows[0]?.total ?? 0);
  const desafios = [
    { codigo: "resumen", nombre: "Complete un resumen de un tema.", completado: hayResumen },
    { codigo: "actividad", nombre: "Realice una actividad.", completado: hayActividad },
    { codigo: "puntos", nombre: `Consiga ${gamificationConfig.puntosDiarios.maximo} puntos en el día.`, completado: puntosBase >= gamificationConfig.puntosDiarios.maximo },
    { codigo: "cartas", nombre: "Complete el resumen en Cartas.", completado: formatos.includes("CARTAS_EXPLICATIVAS") },
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
         SELECT CASE WHEN metadata->>'evento' = 'investigacion' THEN 'Investigación diaria: ' || COALESCE(metadata->>'titulo', 'tema') ELSE COALESCE(metadata->>'titulo', 'Resumen ' || COALESCE(metadata->>'formato', 'estudiado')) END,
                COALESCE(metadata->>'materiaNombre', 'Estudio personal'), 1.0, 1, 1, creada_en, NULL::text, creada_en
         FROM puntos_individuales
         WHERE usuario_id = $1 AND fecha = $2 AND metadata->>'evento' IN ('resumen_completado', 'investigacion')
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

// service -> evidencia de aprendizaje
export async function getEvidenciaAprendizaje(usuarioId: string): Promise<Record<string, unknown>> {
  const [actividades, eventos, temas, conteos] = await Promise.all([
    query<{ titulo: string; tipo: string; porcentaje_acierto: number; tiempo_total_ms: number; total: number; puntos_ganados: number; fecha_inicio: string; material_id: string | null; tema_ruta_id: string | null; numero_tema: string | null; titulo_tema: string | null; preguntas: unknown[]; respuestas: unknown[] }>(
      `SELECT titulo, tipo, porcentaje_acierto::float8 AS porcentaje_acierto, tiempo_total_ms, total, puntos_ganados, fecha_inicio,
              preguntas->0->'contexto'->>'materialId' AS material_id,
              preguntas->0->'contexto'->>'temaRutaId' AS tema_ruta_id,
              preguntas->0->'contexto'->>'numeroTema' AS numero_tema,
              preguntas->0->'contexto'->>'tituloTema' AS titulo_tema,
              preguntas, respuestas
       FROM actividades_gamificadas WHERE usuario_id = $1 ORDER BY fecha_inicio DESC LIMIT 500`,
      [usuarioId],
    ),
    query<{ evento: string; content_id: string; titulo: string; formato: string | null; fecha: string; material_id: string | null; tema_ruta_id: string | null; numero_tema: number | null; titulo_tema: string | null; veces_repetido: number | null; tiempo_lectura_ms: number | null; partes_explicadas: string[] | null; pregunta_indagacion: string | null }>(
      `SELECT metadata->>'evento' AS evento, metadata->>'contentId' AS content_id,
              COALESCE(metadata->>'titulo', '') AS titulo, metadata->>'formato' AS formato,
              metadata->>'materialId' AS material_id, metadata->>'temaRutaId' AS tema_ruta_id,
              NULLIF(metadata->>'numeroTema','')::int AS numero_tema,
              metadata->>'tituloTema' AS titulo_tema,
              NULLIF(metadata->>'vecesRepetido','')::int AS veces_repetido,
              NULLIF(metadata->>'tiempoLecturaMs','')::bigint::float8 AS tiempo_lectura_ms,
              ARRAY(SELECT jsonb_array_elements_text(COALESCE(metadata->'partesExplicadas','[]'::jsonb))) AS partes_explicadas,
              metadata->>'preguntaIndagacion' AS pregunta_indagacion,
              creada_en AS fecha
       FROM puntos_individuales WHERE usuario_id = $1
         AND metadata->>'evento' IN ('resumen_completado', 'investigacion', 'tema_completado')
       ORDER BY creada_en DESC LIMIT 300`,
      [usuarioId],
    ),
    query<{ tema: string }>(
      `SELECT DISTINCT metadata->>'titulo' AS tema FROM puntos_individuales
       WHERE usuario_id = $1 AND metadata->>'evento' = 'investigacion'
         AND NULLIF(BTRIM(metadata->>'titulo'), '') IS NOT NULL ORDER BY tema`,
      [usuarioId],
    ),
    query<{ total_investigaciones: string; resumenes_completados: string }>(
      `SELECT COUNT(*) FILTER (WHERE metadata->>'evento' = 'investigacion') AS total_investigaciones,
              COUNT(*) FILTER (WHERE metadata->>'evento' = 'resumen_completado') AS resumenes_completados
       FROM puntos_individuales WHERE usuario_id = $1
         AND metadata->>'evento' IN ('resumen_completado', 'investigacion')`,
      [usuarioId],
    ),
  ]);
  const actualesPorTema = new Map<string, number>();
  let actividadesSinTema = 0;
  const actividadesRecientes = actividades.rows.filter((item) => {
    if (!item.tema_ruta_id) return actividadesSinTema++ < 5;
    const cuenta = actualesPorTema.get(item.tema_ruta_id) ?? 0;
    actualesPorTema.set(item.tema_ruta_id, cuenta + 1);
    return cuenta < 5;
  });
  const redis = getRedis();
  const progresosTemas: Record<string, unknown>[] = [];
  let cursor = "0";
  do {
    const [siguiente, keys] = await redis.scan(cursor, "MATCH", `gamificacion:tema-progreso:${usuarioId}:*`, "COUNT", 100);
    cursor = String(siguiente);
    if (keys.length) {
      const valores = await redis.mget(...keys);
      for (const valor of valores) {
        if (!valor) continue;
        try { progresosTemas.push(JSON.parse(valor)); } catch { /* Redis -> ignorar progreso corrupto */ }
      }
    }
  } while (cursor !== "0");
  return {
    actividades: actividadesRecientes.map((item) => ({
      titulo: item.titulo,
      tipo: item.tipo,
      porcentaje: Number(item.porcentaje_acierto),
      duracionMs: item.tiempo_total_ms,
      preguntasTotal: item.total,
      tiempoPorPreguntaMs: item.total > 0 ? Math.round(item.tiempo_total_ms / item.total) : 0,
      fecha: asDateTimeString(item.fecha_inicio),
      materialId: item.material_id,
      temaRutaId: item.tema_ruta_id,
      numeroTema: item.numero_tema ? Number(item.numero_tema) : undefined,
      tituloTema: item.titulo_tema,
      preguntas: item.preguntas,
      respuestas: item.respuestas,
    })),
    eventosEstudio: eventos.rows.map((item) => ({
      tipo: item.evento,
      tema: item.titulo,
      contentId: item.content_id,
      materialId: item.material_id,
      temaRutaId: item.tema_ruta_id,
      numeroTema: item.numero_tema ?? undefined,
      tituloTema: item.titulo_tema,
      vecesRepetido: item.veces_repetido ?? undefined,
      tiempoLecturaMs: item.tiempo_lectura_ms === null ? undefined : Number(item.tiempo_lectura_ms),
      partesExplicadas: item.partes_explicadas ?? [],
      preguntaIndagacion: item.pregunta_indagacion,
      formato: item.formato,
      fecha: asDateTimeString(item.fecha),
    })),
    progresosTemas,
    totalActividades: actividadesRecientes.length,
    totalInvestigaciones: Number(conteos.rows[0]?.total_investigaciones ?? 0),
    temasIndagados: temas.rows.map((item) => item.tema),
    temasIndagadosCount: temas.rows.length,
    resumenesCompletados: Number(conteos.rows[0]?.resumenes_completados ?? 0),
  };
}

export async function getTienda(): Promise<RecompensaTienda[]> {
  return getRecompensasActivas();
}

// service -> progreso de estudio diario
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
    tag: string;
    usuario_id: string;
    curso_periodo_id: string;
    paralelo: "A" | "B";
    nombre: string;
    apellido_paterno: string;
    avatar_url: string | null;
  }>(
    `SELECT estudiante_id, usuario_id, tag, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url
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
    tag: row.tag,
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
