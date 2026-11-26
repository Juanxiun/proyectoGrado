// websocket -> servidor nativo Deno + fan-out por Redis pub/sub
import { getClaimsFromToken, extractBearerToken } from "../security/auth.ts";
import type { AuthClaims } from "../security/auth.ts";
import { getRedis } from "../connects/Redis/redis.ts";
import { gamificationConfig } from "../config/gamification.config.ts";

const ROL_PERMITIDO = "estudiante";
const CANAL_GLOBAL = "gamificacion:global";
const CANALES_REDIS = [CANAL_GLOBAL, "gamificacion:paralelo:*", "gamificacion:personal:*"] as const;
const CANAL_VALIDO = /^gamificacion:(global|personal:\d+|paralelo:\d+:[AB])$/;

type Paralelo = "A" | "B";

interface WsClient {
  id: string;
  usuarioId: string;
  socket: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Map<string, WsClient>();
const subscribersByChannel = new Map<string, Set<string>>();

function sendJson(socket: WebSocket, payload: Record<string, unknown>): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch (err) {
    console.warn("[WS] No se pudo enviar mensaje:", err);
  }
}

function subscribe(client: WsClient, canal: string): void {
  client.subscriptions.add(canal);
  const ids = subscribersByChannel.get(canal) ?? new Set<string>();
  ids.add(client.id);
  subscribersByChannel.set(canal, ids);
}

function unsubscribe(client: WsClient, canal: string): void {
  client.subscriptions.delete(canal);
  const ids = subscribersByChannel.get(canal);
  if (!ids) return;
  ids.delete(client.id);
  if (ids.size === 0) subscribersByChannel.delete(canal);
}

function unregister(clientId: string): void {
  const client = clients.get(clientId);
  if (!client) return;
  for (const canal of client.subscriptions) {
    const ids = subscribersByChannel.get(canal);
    ids?.delete(clientId);
    if (ids && ids.size === 0) subscribersByChannel.delete(canal);
  }
  clients.delete(clientId);
}

function canalPermitido(canal: string, claims: AuthClaims): boolean {
  if (!CANAL_VALIDO.test(canal)) return false;
  if (!canal.startsWith("gamificacion:personal:")) return true;
  return canal === `gamificacion:personal:${claims.sub}`;
}

function handleClientMessage(client: WsClient, raw: unknown, claims: AuthClaims): void {
  if (typeof raw !== "string") return;
  let message: { accion?: unknown; canal?: unknown };
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  const accion = String(message.accion ?? "");
  if (accion === "ping") {
    sendJson(client.socket, { evento: "pong", timestamp: new Date().toISOString() });
    return;
  }
  const canal = String(message.canal ?? "");
  if (accion !== "suscribir" && accion !== "desuscribir") return;
  if (!canalPermitido(canal, claims)) {
    sendJson(client.socket, {
      evento: "suscripcion",
      payload: { ok: false, canal, error: "Canal no permitido" },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (accion === "suscribir") subscribe(client, canal);
  else unsubscribe(client, canal);
  sendJson(client.socket, {
    evento: "suscripcion",
    payload: { ok: true, canal, accion },
    timestamp: new Date().toISOString(),
  });
}

function unauthorized(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Valida el token antes del upgrade y registra la conexion autenticada. */
export async function handleWebSocketUpgrade(request: Request): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return unauthorized(426, "Se requiere Upgrade: websocket");
  }
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token") ??
    request.headers.get("sec-websocket-protocol");
  const token = extractBearerToken(rawToken);
  if (!token) return unauthorized(401, "Token requerido");

  const claims = await getClaimsFromToken(token);
  if (!claims) return unauthorized(401, "Token invalido o sesion inactiva");
  if (claims.role !== ROL_PERMITIDO) return unauthorized(403, "Rol no autorizado");

  const { socket, response } = Deno.upgradeWebSocket(request);
  const client: WsClient = {
    id: crypto.randomUUID(),
    usuarioId: claims.sub,
    socket,
    subscriptions: new Set(),
  };
  clients.set(client.id, client);
  subscribe(client, CANAL_GLOBAL);
  subscribe(client, `gamificacion:personal:${claims.sub}`);

  socket.onopen = () => {
    sendJson(socket, {
      evento: "conectado",
      payload: { clienteId: client.id, usuarioId: claims.sub },
      timestamp: new Date().toISOString(),
    });
  };
  socket.onmessage = (event) => handleClientMessage(client, event.data, claims);
  socket.onclose = () => unregister(client.id);
  socket.onerror = () => unregister(client.id);

  console.log(`[WS] Cliente conectado: ${claims.sub} -> ${client.id}`);
  return response;
}

function publicar(canal: string, evento: string, payload: Record<string, unknown>): void {
  const redis = getRedis();
  if (!redis) return;
  const mensaje = JSON.stringify({ evento, payload, timestamp: new Date().toISOString() });
  redis.publish(canal, mensaje).catch((err: unknown) => {
    console.warn("[WS] Error publicando en canal:", err);
  });
}

export function publicarEnCanalWs(
  canal: string,
  evento: string,
  payload: Record<string, unknown>,
): void {
  publicar(canal, evento, payload);
}

export function broadcastToParalelo(
  cursoPeriodoId: string,
  paralelo: Paralelo,
  evento: string,
  payload: Record<string, unknown>,
): void {
  publicar(`gamificacion:paralelo:${cursoPeriodoId}:${paralelo}`, evento, payload);
}

export function broadcastGlobal(evento: string, payload: Record<string, unknown>): void {
  publicar(CANAL_GLOBAL, evento, payload);
}

function notificarPersonal(usuarioId: string, evento: string, payload: Record<string, unknown>): void {
  publicar(`gamificacion:personal:${usuarioId}`, evento, {
    usuarioId,
    ...payload,
    timestamp: new Date().toISOString(),
  });
}

export function notifyPuntosActualizados(usuarioId: string, puntos: number, tipo: string): void {
  notificarPersonal(usuarioId, gamificationConfig.wsEventos.actualizacionPuntos, { puntos, tipo });
}

export function notifyRachaActualizada(usuarioId: string, rachaActual: number, mejorRacha: number): void {
  notificarPersonal(usuarioId, gamificationConfig.wsEventos.actualizacionRacha, { rachaActual, mejorRacha });
}

export function notifyInsigniaGanada(usuarioId: string, insigniaId: string, nombre: string): void {
  notificarPersonal(usuarioId, gamificationConfig.wsEventos.insigniaGanada, { insigniaId, nombre });
}

export function notifyTrofeoGanado(usuarioId: string, trofeoId: string, nombre: string, puntos: number): void {
  const payload = { usuarioId, trofeoId, nombre, puntos };
  notificarPersonal(usuarioId, gamificationConfig.wsEventos.trofeoGanado, payload);
  broadcastGlobal(gamificationConfig.wsEventos.trofeoGanado, payload);
}

export function notifyAlertaRanking(
  usuarioId: string,
  mensaje: string,
  posicionActual: number,
  posicionAmenaza: number,
): void {
  notificarPersonal(usuarioId, gamificationConfig.wsEventos.alertaRanking, {
    mensaje,
    posicionActual,
    posicionAmenaza,
  });
}

export function notifyRecompensaGlobal(
  cursoPeriodoId: string,
  paralelo: Paralelo,
  recompensa: string,
  descripcion: string,
): void {
  broadcastToParalelo(cursoPeriodoId, paralelo, gamificationConfig.wsEventos.recompensaGlobal, {
    cursoPeriodoId,
    paralelo,
    recompensa,
    descripcion,
  });
}

let subscriber: ReturnType<typeof getRedis> | null = null;

/** Escucha los canales de Redis y reenvia cada evento a sus suscriptores locales. */
export async function initRedisListener(): Promise<void> {
  if (subscriber) return;
  const redis = getRedis();
  if (!redis) {
    console.warn("[WS] Redis no disponible; listener no iniciado");
    return;
  }
  subscriber = redis.duplicate();
  subscriber.on("error", (err: Error) => console.warn("[WS] Redis subscriber:", err.message));
  subscriber.on("pmessage", (_pattern: string, canal: string, mensaje: string) => {
    const ids = subscribersByChannel.get(canal);
    if (!ids?.size) return;
    for (const clientId of ids) {
      const client = clients.get(clientId);
      if (client) sendJson(client.socket, JSON.parse(mensaje) as Record<string, unknown>);
    }
  });
  await subscriber.psubscribe(...CANALES_REDIS);
  console.log("[WS] Redis listener iniciado");
}

export function getConnectedCount(): number {
  return clients.size;
}

export async function closeWebSockets(): Promise<void> {
  for (const client of clients.values()) {
    try {
      client.socket.close(1001, "Servicio reiniciando");
    } catch {
      // socket ya cerrado
    }
  }
  clients.clear();
  subscribersByChannel.clear();
  if (subscriber) {
    try {
      await subscriber.quit();
    } catch {
      // redis ya cerrado
    }
    subscriber = null;
  }
}
