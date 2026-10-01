// server.ts - ServiceNotification (Central de Notificaciones)
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_GESTION } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import {
  countNotificaciones,
  deleteNotificacion,
  getNotificacion,
  listNotificaciones,
  readAllNotificaciones,
  readNotificacion,
} from "./controllers/notificaciones.controller.ts";
import {
  emitirNotificacion,
  estadoEventos,
  listarReglas,
} from "./controllers/eventos.controller.ts";
import { iniciarBusEventos } from "./services/eventBus.service.ts";
import { eventosRegistrados } from "./services/reglas.service.ts";
import { notificationConfig } from "./config/notification.config.ts";

// Rango de microservicios: 8880–8884.
const PORT = Number(Deno.env.get("PORT") ?? 8884);

const app = new Application();
const rt = new Router();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(async (ctx: Context, next: Next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status} (${ms}ms)`);
});

// ── Webhook (el gateway es quien lo invoca) ─────────────────────────────────
rt.post("/webhook", handleWebhookEvent);

// ── Bandeja del usuario ─────────────────────────────────────────────────────
// Las rutas literales se registran antes que "/:id" para que Oak no las capture.
rt.get("/notificaciones", requireAuth(), listNotificaciones);
rt.get("/notificaciones/conteo", requireAuth(), countNotificaciones);
rt.get("/notificaciones/reglas", requireAuth(ROLES_GESTION), listarReglas);
rt.get("/notificaciones/:id", requireAuth(), getNotificacion);
rt.post("/notificaciones/leer-todas", requireAuth(), readAllNotificaciones);
rt.post("/notificaciones/:id/read", requireAuth(), readNotificacion);
rt.delete("/notificaciones/:id", requireAuth(), deleteNotificacion);

// ── Emisión y bus de eventos ────────────────────────────────────────────────
rt.post("/notificaciones/emitir", requireAuth(ROLES_GESTION), emitirNotificacion);
rt.get("/eventos/estado", requireAuth(ROLES_GESTION), estadoEventos);

// ── Health Check ────────────────────────────────────────────────────────────
rt.get("/health", (ctx: Context) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceNotification",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: [
      "Central de notificaciones de todo el sistema",
      `Catálogo de ${eventosRegistrados().length} eventos de dominio`,
      `Bus de eventos Redis (${notificationConfig.eventosCanal})`,
      `Retención de ${notificationConfig.ttlDias} días`,
      "Push en tiempo real vía gateway SignalR",
    ],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx: Context) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

// El bus de eventos arranca con el servicio: sin suscripción no hay catálogo.
iniciarBusEventos().catch((err) => {
  console.error("[EventBus] No se pudo iniciar la suscripción:", err);
});

console.log(`ServiceNotification corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /notificaciones`);
console.log(`   GET    /notificaciones/conteo`);
console.log(`   POST   /notificaciones/:id/read`);
console.log(`   POST   /notificaciones/leer-todas`);
console.log(`   POST   /notificaciones/emitir`);
console.log(`   GET    /eventos/estado`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });
