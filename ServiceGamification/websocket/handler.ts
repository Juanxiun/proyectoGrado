import { WebSocket } from "ws";
import { getClaimsFromToken, extractBearerToken } from "../security/auth.ts";
import { getRedis } from "../connects/Redis/redis.ts";
import { redisConfig } from "../config/redis.conf.ts";
import { gamificationConfig } from "../config/gamification.config.ts";

interface WSClient {
  ws: WebSocket;
  usuarioId: string;
  estudianteId: string;
  cursoPeriodoId: string;
  paralelo: "A" | "B";
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
      if (!claims || claims.role !== "estudiante") {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // obtener info estudiante
      // todo: query a BD para obtener estudianteId, cursoPeriodoId, paralelo
      const ws = new WebSocket(null);
      (ws as any)._socket = socket;
      (ws as any)._receiver = head;

      // todo: completar handshake
      const clientId = claims.sub;
      clients.set(clientId, {
        ws,
        usuarioId: claims.sub,
        estudianteId: "", // todo: query
        cursoPeriodoId: "", // todo: query
        paralelo: "A",
        subscriptions: new Set(["global", "paralelo", "personal"]),
      });

      console.log(`[WS] Cliente conectado: ${clientId}`);
    } catch (err) {
      console.warn("[WS] Error en upgrade:", err);
      socket.destroy();
    }
  });
}

export function broadcastToCanal(canal: string, evento: string, payload: Record<string, unknown>): void {
  const mensaje = JSON.stringify({ evento, payload, timestamp: new Date().toISOString() });
  redis.publish(canal, mensaje).catch((err: Error) => {
    console.warn("[WS] Error publicando en canal:", err.message);
  });
}

export function broadcastToParalelo(cursoPeriodoId: string, paralelo: "A" | "B", evento: string, payload: Record<string, unknown>): void {
  const canal = `gamificacion:paralelo:${cursoPeriodoId}:${paralelo}`;
  broadcastToCanal(canal, evento, payload);
}

export function broadcastGlobal(evento: string, payload: Record<string, unknown>): void {
  broadcastToCanal("gamificacion:global", evento, payload);
}

export function notifyPuntosActualizados(usuarioId: string, puntos: number, tipo: string): void {
  const canal = `gamificacion:personal:${usuarioId}`;
  broadcastToCanal(canal, gamificationConfig.wsEventos.actualizacionPuntos, {
    usuarioId,
    puntos,
    tipo,
    timestamp: new Date().toISOString(),
  });
}

export function notifyRachaActualizada(usuarioId: string, rachaActual: number, mejorRacha: number): void {
  const canal = `gamificacion:personal:${usuarioId}`;
  broadcastToCanal(canal, gamificationConfig.wsEventos.actualizacionRacha, {
    usuarioId,
    rachaActual,
    mejorRacha,
    timestamp: new Date().toISOString(),
  });
}

export function notifyInsigniaGanada(usuarioId: string, insigniaId: string, nombre: string): void {
  const canal = `gamificacion:personal:${usuarioId}`;
  broadcastToCanal(canal, gamificationConfig.wsEventos.insigniaGanada, {
    usuarioId,
    insigniaId,
    nombre,
    timestamp: new Date().toISOString(),
  });
  // notificar a todo el paralelo
  // broadcastToParalelo(...)
}

export function notifyTrofeoGanado(usuarioId: string, trofeoId: string, nombre: string, puntos: number): void {
  const canal = `gamificacion:personal:${usuarioId}`;
  broadcastToCanal(canal, gamificationConfig.wsEventos.trofeoGanado, {
    usuarioId,
    trofeoId,
    nombre,
    puntos,
    timestamp: new Date().toISOString(),
  });
  broadcastGlobal(gamificationConfig.wsEventos.trofeoGanado, {
    usuarioId,
    trofeoId,
    nombre,
    puntos,
    timestamp: new Date().toISOString(),
  });
}

export function notifyAlertaRanking(usuarioId: string, mensaje: string, posicionActual: number, posicionAmenaza: number): void {
  const canal = `gamificacion:personal:${usuarioId}`;
  broadcastToCanal(canal, gamificationConfig.wsEventos.alertaRanking, {
    usuarioId,
    mensaje,
    posicionActual,
    posicionAmenaza,
    timestamp: new Date().toISOString(),
  });
}

export function notifyRecompensaGlobal(cursoPeriodoId: string, paralelo: "A" | "B", recompensa: string, descripcion: string): void {
  broadcastToParalelo(cursoPeriodoId, paralelo, gamificationConfig.wsEventos.recompensaGlobal, {
    cursoPeriodoId,
    paralelo,
    recompensa,
    descripcion,
    timestamp: new Date().toISOString(),
  });
}

// listener -> suscribirse a canales redis y reenviar a websockets
export async function initRedisListener(): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.subscribe("gamificacion:global", "gamificacion:paralelo:*", "gamificacion:personal:*");

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