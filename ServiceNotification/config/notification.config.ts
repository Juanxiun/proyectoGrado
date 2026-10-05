export const notificationConfig = {
  // config -> canal eventos redis
  eventosCanal: Deno.env.get("EVENTOS_CANAL") ?? "notificaciones:eventos",

  // config -> ttl notificacion
  ttlDias: Number(Deno.env.get("NOTIF_TTL_DIAS") ?? 30),

  // config -> limite consulta
  maxPorConsulta: Number(Deno.env.get("NOTIF_MAX_POR_CONSULTA") ?? 50),

  // config -> url gateway push
  gatewayPublicUrl: Deno.env.get("GATEWAY_PUBLIC_URL") ?? "http://localhost:5141",

  // config -> token push interno
  internalPushToken: Deno.env.get("INTERNAL_PUSH_TOKEN") ?? "shalom-internal-push",

  // config -> habilitar push
  pushHabilitado: (Deno.env.get("PUSH_TIEMPO_REAL") ?? "true").toLowerCase() === "true",
};

export const NOTIF_TTL_SECONDS = notificationConfig.ttlDias * 24 * 60 * 60;
