export const notificationConfig = {
  /** Canal Redis (pub/sub) donde los servicios publican sus eventos de dominio. */
  eventosCanal: Deno.env.get("EVENTOS_CANAL") ?? "notificaciones:eventos",

  /** Días que se conserva una notificación antes de expirar en Redis. */
  ttlDias: Number(Deno.env.get("NOTIF_TTL_DIAS") ?? 30),

  /** Máximo de notificaciones devueltas por consulta de bandeja. */
  maxPorConsulta: Number(Deno.env.get("NOTIF_MAX_POR_CONSULTA") ?? 50),

  /** Destino del push en tiempo real (el gateway es el único que expone sockets). */
  gatewayPublicUrl: Deno.env.get("GATEWAY_PUBLIC_URL") ?? "http://localhost:5141",

  /** Secreto compartido con RestApi (`Internal:PushToken`) para autenticar el push. */
  internalPushToken: Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push",

  /** Si el push por WebSocket está habilitado. */
  pushHabilitado: (Deno.env.get("PUSH_TIEMPO_REAL") ?? "true").toLowerCase() === "true",
};

export const NOTIF_TTL_SECONDS = notificationConfig.ttlDias * 24 * 60 * 60;
