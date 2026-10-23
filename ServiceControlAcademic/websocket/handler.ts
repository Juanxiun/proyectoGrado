import { WebSocket } from "ws";
import { getClaimsFromToken, extractBearerToken } from "../security/auth.ts";
import { getRedis } from "../connects/Redis/redis.ts";
import { redisConfig } from "../config/redis.conf.ts";
import { controlAcademicoConfig } from "../config/control-academico.config.ts";

interface WSClient {
  ws: WebSocket;
  usuarioId: string;
  estudianteId?: string;
  maestroId?: string;
  rol: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, WSClient>();
const redis = getRedis();

export function initWebSocketServer(server: any): void {
  server.on("upgrade", async (request: any, socket: any, head: any) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = extractBearerToken(url.searchParams.get("token") ?? request.headers["sec-websocket-protocol"]);

      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const claims = await getClaimsFromToken(token);
      if (!claims) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // solo docentes, director, control para control academico
      if (!["profesor", "director", "control"].includes(claims.role)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      const ws = new WebSocket(null);
      (ws as any)._socket = socket;
      (ws as any)._receiver = head;

      // completar handshake manualmente
      const clientId = claims.sub;
      clients.set(clientId, {
        ws,
        usuarioId: claims.sub,
        estudianteId: claims.estudianteId,
        maestroId: claims.maestroId,
        rol: claims.role,
        subscriptions: new Set(["global", "personal"]),
      });

      console.log(`[WS] Cliente conectado: ${clientId} (${claims.role})`);
    } catch (err) {
      console.warn("[WS] Error en upgrade:", err);
      socket.destroy();
    }
  });
}

export function broadcastToCanal(canal: string, evento: string, payload: Record<string, unknown>): void {
  const mensaje = JSON.stringify({ evento, payload, timestamp: new Date().toISOString() });
  redis.publish(canal, mensaje).catch((err: unknown) => {
    console.warn("[WS] Error publicando en canal:", err);
  });
}

export function broadcastToMateria(materiaId: string, evento: string, payload: Record<string, unknown>): void {
  const canal = `control:materia:${materiaId}`;
  broadcastToCanal(canal, evento, payload);
}

export function broadcastToCurso(cursoPeriodoId: string, evento: string, payload: Record<string, unknown>): void {
  const canal = `control:curso:${cursoPeriodoId}`;
  broadcastToCanal(canal, evento, payload);
}

export function broadcastGlobal(evento: string, payload: Record<string, unknown>): void {
  broadcastToCanal("control:global", evento, payload);
}

export function notifyAsistencia(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.asistenciaRegistrada, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyCalificacion(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.calificacionRegistrada, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyTemaCompletado(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.temaCompletado, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyExamen(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.examenRegistrado, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAlertaRiesgo(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.alertaRiesgo, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyReporte(usuarioId: string, payload: Record<string, unknown>): void {
  const canal = `control:personal:${usuarioId}`;
  broadcastToCanal(canal, controlAcademicoConfig.wsEventos.reporteGenerado, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyRecompensaGlobal(cursoPeriodoId: string, payload: Record<string, unknown>): void {
  broadcastToCurso(cursoPeriodoId, controlAcademicoConfig.wsEventos.recompensaGlobal, payload);
}

// listener -> suscribirse a canales redis y reenviar a websockets
export async function initRedisListener(): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.subscribe("control:global", "control:materia:*", "control:curso:*", "control:personal:*");

  subscriber.on("message", (canal: string, mensaje: string) => {
    try {
      const { evento, payload } = JSON.parse(mensaje);
      // reenviar a clientes conectados en ese canal
      for (const [clientId, client] of clients) {
        if (client.subscriptions.has(canal) || client.subscriptions.has("global")) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({ evento, payload, timestamp: new Date().toISOString() }));
          }
        }
      }
    } catch (err) {
      console.warn("[WS] Error procesando mensaje redis:", err);
    }
  });

  console.log("[WS] Redis listener iniciado");
}

export function removeClient(usuarioId: string): void {
  clients.delete(usuarioId);
}

export function getConnectedCount(): number {
  return clients.size;
}