// websocket -> servidor nativo Deno + fan-out por Redis pub/sub
import { getClaimsFromToken, extractBearerToken } from "../security/auth.ts";
import type { AuthClaims } from "../security/auth.ts";
import { getRedis } from "../connects/Redis/redis.ts";
import { controlAcademicoConfig } from "../config/control-academico.config.ts";

const ROLES_PERMITIDOS = new Set(["profesor", "director", "control"]);
const CANAL_GLOBAL = "control:global";
const CANALES_REDIS = [CANAL_GLOBAL, "control:materia:*", "control:curso:*", "control:personal:*"] as const;
const CANAL_VALIDO = /^control:(global|materia:\d+|curso:\d+|personal:\d+)$/;

interface WsClient {
  id: string;
  usuarioId: string;
  rol: string;
  socket: WebSocket;
  subscriptions: Set<string>;
}

const clients = new Map<string, WsClient>();
// indice invertido -> enviar solo a los suscriptores del canal, sin recorrer todos los clientes
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
  if (!canal.startsWith("control:personal:")) return true;
  return canal === `control:personal:${claims.sub}`;
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
  if (!ROLES_PERMITIDOS.has(claims.role)) return unauthorized(403, "Rol no autorizado");

  const { socket, response } = Deno.upgradeWebSocket(request);
  const client: WsClient = {
    id: crypto.randomUUID(),
    usuarioId: claims.sub,
    rol: claims.role,
    socket,
    subscriptions: new Set(),
  };
  clients.set(client.id, client);
  subscribe(client, CANAL_GLOBAL);
  subscribe(client, `control:personal:${claims.sub}`);

  socket.onopen = () => {
    sendJson(socket, {
      evento: "conectado",
      payload: { clienteId: client.id, usuarioId: claims.sub, rol: claims.role },
      timestamp: new Date().toISOString(),
    });
  };
  socket.onmessage = (event) => handleClientMessage(client, event.data, claims);
  socket.onclose = () => unregister(client.id);
  socket.onerror = () => unregister(client.id);

  console.log(`[WS] Cliente conectado: ${claims.sub} (${claims.role}) -> ${client.id}`);
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

export function broadcastToCanal(canal: string, evento: string, payload: Record<string, unknown>): void {
  publicar(canal, evento, payload);
}

export function broadcastToMateria(materiaId: string, evento: string, payload: Record<string, unknown>): void {
  publicar(`control:materia:${materiaId}`, evento, payload);
}

export function broadcastToCurso(cursoPeriodoId: string, evento: string, payload: Record<string, unknown>): void {
  publicar(`control:curso:${cursoPeriodoId}`, evento, payload);
}

export function broadcastGlobal(evento: string, payload: Record<string, unknown>): void {
  publicar(CANAL_GLOBAL, evento, payload);
}

function notificarPersonal(usuarioId: string, evento: string, payload: Record<string, unknown>): void {
  publicar(`control:personal:${usuarioId}`, evento, { usuarioId, ...payload, timestamp: new Date().toISOString() });
}

export function notifyAsistencia(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.asistenciaRegistrada, payload);
}

export function notifyCalificacion(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.calificacionRegistrada, payload);
}

export function notifyTemaCompletado(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.temaCompletado, payload);
}

export function notifyExamen(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.examenRegistrado, payload);
}

export function notifyAlertaRiesgo(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.alertaRiesgo, payload);
}

export function notifyReporte(usuarioId: string, payload: Record<string, unknown>): void {
  notificarPersonal(usuarioId, controlAcademicoConfig.wsEventos.reporteGenerado, payload);
}

export function notifyRecompensaGlobal(cursoPeriodoId: string, payload: Record<string, unknown>): void {
  broadcastToCurso(cursoPeriodoId, controlAcademicoConfig.wsEventos.recompensaGlobal, payload);
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
