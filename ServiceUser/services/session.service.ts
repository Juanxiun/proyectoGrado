import { getRedis } from "../connects/Redis/redis.ts";
import { DeviceInfo, LocationInfo, normalizarDispositivo, normalizarUbicacion } from "../utils/deviceDetector.ts";
import {
  calculateHaversineDistanceKm,
  evaluateStudentDistanceCheating,
  PreviousSessionGeo,
} from "../utils/geoDistance.ts";

export interface SessionRecord {
  sessionId: string;
  usuarioId: string;
  username: string;
  rol: string;
  dispositivo: DeviceInfo;
  ubicacion?: LocationInfo;
  inicioConexion: string;
  finalConexion: string | null;
  tiempoConectado: string;
  tiempoConectadoSegundos: number;
  activo: boolean;
  posibleTrampa: boolean;
  alertaTrampa: string | null;
  motivoCierre: string | null;
  ultimaActividad: string;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// sesion -> normalizar datos guardados
function normalizarSesion(valor: unknown): SessionRecord | null {
  if (!valor || typeof valor !== "object") return null;
  const fila = valor as Record<string, unknown>;
  const sessionId = typeof fila.sessionId === "string" ? fila.sessionId : "";
  const usuarioId = typeof fila.usuarioId === "string" ? fila.usuarioId : "";
  const inicioConexion = typeof fila.inicioConexion === "string" ? fila.inicioConexion : "";
  if (!sessionId || !usuarioId || !Number.isFinite(Date.parse(inicioConexion))) return null;
  return {
    ...(fila as unknown as SessionRecord),
    sessionId,
    usuarioId,
    username: typeof fila.username === "string" ? fila.username : "",
    rol: typeof fila.rol === "string" ? fila.rol : "",
    dispositivo: normalizarDispositivo(fila.dispositivo ?? fila.deviceInfo),
    ubicacion: normalizarUbicacion(fila.ubicacion ?? fila.locationInfo),
    inicioConexion,
    finalConexion: typeof fila.finalConexion === "string" ? fila.finalConexion : null,
    tiempoConectado: typeof fila.tiempoConectado === "string" ? fila.tiempoConectado : "",
    tiempoConectadoSegundos: Number.isFinite(Number(fila.tiempoConectadoSegundos))
      ? Math.max(0, Number(fila.tiempoConectadoSegundos))
      : 0,
    activo: fila.activo === true,
    posibleTrampa: fila.posibleTrampa === true,
    alertaTrampa: typeof fila.alertaTrampa === "string" ? fila.alertaTrampa : null,
    motivoCierre: typeof fila.motivoCierre === "string" ? fila.motivoCierre : null,
    ultimaActividad: typeof fila.ultimaActividad === "string" ? fila.ultimaActividad : inicioConexion,
  };
}

// sesion -> detectar cambio conjunto de dispositivo y direccion
function cambioDispositivoYDireccion(actual: DeviceInfo, actualUbicacion: LocationInfo | undefined, anterior: SessionRecord): boolean {
  const dispositivoNuevo = actual.device.trim().toLowerCase() !== anterior.dispositivo.device.trim().toLowerCase();
  const ipNueva = Boolean(actual.ip && anterior.dispositivo.ip && actual.ip !== anterior.dispositivo.ip);
  const ubicacionAnterior = anterior.ubicacion;
  const coordenadasDistintas = actualUbicacion?.lat !== undefined && actualUbicacion.lon !== undefined &&
    ubicacionAnterior?.lat !== undefined && ubicacionAnterior.lon !== undefined &&
    calculateHaversineDistanceKm(actualUbicacion.lat, actualUbicacion.lon, ubicacionAnterior.lat, ubicacionAnterior.lon) >= 10;
  const zonaActual = (actualUbicacion?.zona || actualUbicacion?.ciudad || "").trim().toLowerCase();
  const zonaAnterior = (ubicacionAnterior?.zona || ubicacionAnterior?.ciudad || "").trim().toLowerCase();
  const zonaDistinta = Boolean(zonaActual && zonaAnterior && zonaActual !== zonaAnterior);
  return dispositivoNuevo && (ipNueva || coordenadasDistintas || zonaDistinta);
}

// sesion -> crear con reglas anti trampa
export async function createSession(params: {
  usuarioId: string;
  username: string;
  rol: string;
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
}): Promise<{ session: SessionRecord; closedPreviousSessions: string[] }> {
  const redis = getRedis();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const nowIso = now.toISOString();
  const cleanRol = (params.rol || "").trim().toLowerCase();
  const isEstudiante = cleanRol === "estudiante";
  const deviceInfo = normalizarDispositivo(params.deviceInfo);
  const locationInfo = normalizarUbicacion(params.locationInfo);

  const closedPreviousSessions: string[] = [];
  let posibleTrampa = false;
  let alertaTrampa: string | null = null;

  const sessionTtl = 60 * 60 * 24 * 7;
  const activeSessionsKey = `user:active_sessions:${params.usuarioId}`;
  const historySessionsKey = `user:history_sessions:${params.usuarioId}`;

  if (isEstudiante) {
    try {
      const activeIds = await redis.smembers(activeSessionsKey);
      const previousGeoSessions: PreviousSessionGeo[] = [];
      const previousRecords: SessionRecord[] = [];

      for (const sid of activeIds) {
        const sRaw = await redis.get(`session:${sid}`);
        if (sRaw) {
          const sObj = normalizarSesion(JSON.parse(sRaw));
          if (!sObj) continue;
          previousRecords.push(sObj);
          previousGeoSessions.push({
            sessionId: sObj.sessionId,
            ubicacion: sObj.ubicacion,
            inicioConexion: sObj.inicioConexion,
            dispositivo: sObj.dispositivo,
          });
        }
      }

      const recentIds: string[] = await redis.lrange(historySessionsKey, 0, 10);
      for (const sid of recentIds) {
        if (activeIds.includes(sid)) continue;
        const sRaw = await redis.get(`session:${sid}`);
        if (!sRaw) continue;
        const previous = normalizarSesion(JSON.parse(sRaw));
        if (!previous) continue;
        previousRecords.push(previous);
        break;
      }

      const anotherDeviceAndAddress = previousRecords.some((previous) =>
        cambioDispositivoYDireccion(deviceInfo, locationInfo, previous)
      );
      if (anotherDeviceAndAddress) {
        const incident = {
          tipo: "acceso_dispositivo_direccion_distintos",
          usuarioId: params.usuarioId,
          username: params.username,
          sessionId,
          timestamp: nowIso,
          alerta: "Inicio de sesión desde un dispositivo y una dirección de conexión distintos a una sesión reciente. Verificar con el estudiante.",
          dispositivo: deviceInfo,
          ubicacion: locationInfo,
        };
        await redis.lpush(`student_cheat_alerts:${params.usuarioId}`, JSON.stringify(incident));
        await redis.ltrim(`student_cheat_alerts:${params.usuarioId}`, 0, 19);
        await redis.lpush(`global_cheat_alerts`, JSON.stringify(incident));
      }

      if (locationInfo) {
        const cheatEval = evaluateStudentDistanceCheating(
          locationInfo,
          previousGeoSessions,
          now,
        );

        if (cheatEval.posibleTrampa) {
          posibleTrampa = true;
          alertaTrampa = cheatEval.alertaMensaje ?? "Posible trampa detectada en inicio de sesión simultáneo/distante.";
          console.warn(`[ANTI-TRAMPA] ${alertaTrampa} (Estudiante @${params.username})`);

          const alertIncident = {
            usuarioId: params.usuarioId,
            username: params.username,
            sessionId,
            timestamp: nowIso,
            alerta: alertaTrampa,
            dispositivo: deviceInfo,
            ubicacion: locationInfo,
          };
          await redis.lpush(`student_cheat_alerts:${params.usuarioId}`, JSON.stringify(alertIncident));
          await redis.lpush(`global_cheat_alerts`, JSON.stringify(alertIncident));
        }
      }
    } catch (evalErr) {
      console.error("[Session] Error en evaluación anti-trampa:", evalErr);
    }
  }

  if (!isEstudiante) {
    try {
      const activeIds = await redis.smembers(activeSessionsKey);

      for (const oldSid of activeIds) {
        const oldRaw = await redis.get(`session:${oldSid}`);
        if (oldRaw) {
          const oldSession: SessionRecord = JSON.parse(oldRaw);
          if (oldSession.activo) {
            const startMs = new Date(oldSession.inicioConexion).getTime();
            const durationMs = Math.max(0, now.getTime() - startMs);

            oldSession.activo = false;
            oldSession.finalConexion = nowIso;
            oldSession.tiempoConectado = formatDuration(durationMs);
            oldSession.tiempoConectadoSegundos = Math.floor(durationMs / 1000);
            oldSession.motivoCierre = "Cierre automático: inicio de sesión en otro dispositivo";

            await redis.set(`session:${oldSid}`, JSON.stringify(oldSession), "EX", sessionTtl);
            await redis.srem(activeSessionsKey, oldSid);
            closedPreviousSessions.push(oldSid);

            console.log(
              `[Session] Sesión previa ${oldSid} de @${params.username} (${params.rol}) cerrada automáticamente. Estuvo conectado: ${oldSession.tiempoConectado}`,
            );
          }
        }
      }
    } catch (closeErr) {
      console.error("[Session] Error al cerrar sesiones previas de no-estudiante:", closeErr);
    }
  }

  const newSession: SessionRecord = {
    sessionId,
    usuarioId: params.usuarioId,
    username: params.username,
    rol: params.rol,
    dispositivo: deviceInfo,
    ubicacion: locationInfo,
    inicioConexion: nowIso,
    finalConexion: null,
    tiempoConectado: "En curso",
    tiempoConectadoSegundos: 0,
    activo: true,
    posibleTrampa,
    alertaTrampa,
    motivoCierre: null,
    ultimaActividad: nowIso,
  };

  try {
    await redis.set(`session:${sessionId}`, JSON.stringify(newSession), "EX", sessionTtl);
    await redis.sadd(activeSessionsKey, sessionId);
    await redis.lpush(historySessionsKey, sessionId);
    await redis.ltrim(historySessionsKey, 0, 99);
  } catch (saveErr) {
    console.error("[Session] Error guardando nueva sesión en Redis:", saveErr);
    throw new Error("No se pudo guardar la sesión en Redis", { cause: saveErr });
  }

  return {
    session: newSession,
    closedPreviousSessions,
  };
}

export async function closeSession(
  sessionId: string,
  motivo = "Cierre de sesión por el usuario",
): Promise<SessionRecord | null> {
  const redis = getRedis();
  const sessionKey = `session:${sessionId}`;

  const raw = await redis.get(sessionKey);
  if (!raw) return null;

  const session = normalizarSesion(JSON.parse(raw));
  if (!session) return null;
  if (!session.activo) return session;

  const now = new Date();
  const startMs = new Date(session.inicioConexion).getTime();
  const durationMs = Math.max(0, now.getTime() - startMs);

  session.activo = false;
  session.finalConexion = now.toISOString();
  session.tiempoConectado = formatDuration(durationMs);
  session.tiempoConectadoSegundos = Math.floor(durationMs / 1000);
  session.motivoCierre = motivo;
  session.ultimaActividad = now.toISOString();

  const sessionTtl = 60 * 60 * 24 * 7;
  await redis.set(sessionKey, JSON.stringify(session), "EX", sessionTtl);
  await redis.srem(`user:active_sessions:${session.usuarioId}`, sessionId);

  console.log(
    `[Session] Sesión ${sessionId} finalizada para @${session.username}. Tiempo conectado: ${session.tiempoConectado}`,
  );

  return session;
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const redis = getRedis();
  const raw = await redis.get(`session:${sessionId}`);
  if (!raw) return null;
  return normalizarSesion(JSON.parse(raw));
}

// sesion -> listar historial y alertas
export async function getUserSessions(usuarioId: string): Promise<{
  activeSessions: SessionRecord[];
  historySessions: SessionRecord[];
  cheatAlerts?: unknown[];
}> {
  const redis = getRedis();
  const activeIds = await redis.smembers(`user:active_sessions:${usuarioId}`);
  const historyIds = await redis.lrange(`user:history_sessions:${usuarioId}`, 0, 49);

  const activeSessions: SessionRecord[] = [];
  const historySessions: SessionRecord[] = [];

  for (const sid of activeIds) {
    const raw = await redis.get(`session:${sid}`);
    if (raw) {
      const s = normalizarSesion(JSON.parse(raw));
      if (!s) continue;
      if (s.activo) {
        const durationMs = Date.now() - new Date(s.inicioConexion).getTime();
        s.tiempoConectado = formatDuration(durationMs);
        s.tiempoConectadoSegundos = Math.floor(durationMs / 1000);
        activeSessions.push(s);
      } else {
        await redis.srem(`user:active_sessions:${usuarioId}`, sid);
      }
    }
  }

  for (const sid of historyIds) {
    if (activeIds.includes(sid)) continue;
    const raw = await redis.get(`session:${sid}`);
    if (raw) {
      const session = normalizarSesion(JSON.parse(raw));
      if (session) historySessions.push(session);
    }
  }

  const rawAlerts: string[] = await redis.lrange(`student_cheat_alerts:${usuarioId}`, 0, 19);
  const cheatAlerts = rawAlerts.map((a: string) => {
    try {
      return JSON.parse(a);
    } catch {
      return a;
    }
  });

  return {
    activeSessions,
    historySessions,
    cheatAlerts,
  };
}

export async function isSessionValidAndActive(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  return session !== null && session.activo === true;
}
