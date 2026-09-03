import { getRedis } from "../connects/Redis/redis.ts";
import { DeviceInfo, LocationInfo } from "../utils/deviceDetector.ts";
import {
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

  const closedPreviousSessions: string[] = [];
  let posibleTrampa = false;
  let alertaTrampa: string | null = null;

  const sessionTtl = 60 * 60 * 24 * 7; // 7 días en segundos
  const activeSessionsKey = `user:active_sessions:${params.usuarioId}`;
  const historySessionsKey = `user:history_sessions:${params.usuarioId}`;

  // 1. REGLA PARA ESTUDIANTES: Análisis de trampas por distancia geográfica
  if (isEstudiante) {
    try {
      const activeIds = await redis.smembers(activeSessionsKey);
      const previousGeoSessions: PreviousSessionGeo[] = [];

      for (const sid of activeIds) {
        const sRaw = await redis.get(`session:${sid}`);
        if (sRaw) {
          const sObj: SessionRecord = JSON.parse(sRaw);
          previousGeoSessions.push({
            sessionId: sObj.sessionId,
            ubicacion: sObj.ubicacion,
            inicioConexion: sObj.inicioConexion,
            dispositivo: sObj.dispositivo,
          });
        }
      }

      if (params.locationInfo) {
        const cheatEval = evaluateStudentDistanceCheating(
          params.locationInfo,
          previousGeoSessions,
          now,
        );

        if (cheatEval.posibleTrampa) {
          posibleTrampa = true;
          alertaTrampa = cheatEval.alertaMensaje ?? "Posible trampa detectada en inicio de sesión simultáneo/distante.";
          console.warn(`[ANTI-TRAMPA] ${alertaTrampa} (Estudiante @${params.username})`);

          // Guardar incidente de alerta en Redis para auditoría
          const alertIncident = {
            usuarioId: params.usuarioId,
            username: params.username,
            sessionId,
            timestamp: nowIso,
            alerta: alertaTrampa,
            dispositivo: params.deviceInfo,
            ubicacion: params.locationInfo,
          };
          await redis.lpush(`student_cheat_alerts:${params.usuarioId}`, JSON.stringify(alertIncident));
          await redis.lpush(`global_cheat_alerts`, JSON.stringify(alertIncident));
        }
      }
    } catch (evalErr) {
      console.error("[Session] Error en evaluación anti-trampa:", evalErr);
    }
  }

  // 2. REGLA PARA NO ESTUDIANTES (Director, Maestros, Control, etc.):
  // Cierre automático de cualquier sesión previa en otro dispositivo
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

  // 3. Crear el nuevo registro de sesión
  const newSession: SessionRecord = {
    sessionId,
    usuarioId: params.usuarioId,
    username: params.username,
    rol: params.rol,
    dispositivo: params.deviceInfo,
    ubicacion: params.locationInfo,
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
    // Guardar sesión individual
    await redis.set(`session:${sessionId}`, JSON.stringify(newSession), "EX", sessionTtl);
    // Registrar en conjunto de sesiones activas del usuario
    await redis.sadd(activeSessionsKey, sessionId);
    // Registrar en historial general de sesiones del usuario
    await redis.lpush(historySessionsKey, sessionId);
    // Mantener solo las últimas 100 sesiones en el historial
    await redis.ltrim(historySessionsKey, 0, 99);
  } catch (saveErr) {
    console.warn("[Session] Error guardando nueva sesión en Redis:", saveErr);
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

  const session: SessionRecord = JSON.parse(raw);
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
  return JSON.parse(raw);
}

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
      const s: SessionRecord = JSON.parse(raw);
      // Calcular tiempo transcurrido en tiempo real
      if (s.activo) {
        const durationMs = Date.now() - new Date(s.inicioConexion).getTime();
        s.tiempoConectado = formatDuration(durationMs);
        s.tiempoConectadoSegundos = Math.floor(durationMs / 1000);
      }
      activeSessions.push(s);
    }
  }

  for (const sid of historyIds) {
    const raw = await redis.get(`session:${sid}`);
    if (raw) {
      historySessions.push(JSON.parse(raw));
    }
  }

  // Alertas de trampa (si existen)
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
