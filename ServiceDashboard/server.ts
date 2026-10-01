// server.ts - ServiceDashboard (Tablero de Inicio, sólo lectura)
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_LECTURA } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import {
  getAcademico,
  getAsistencia,
  getDashboard,
  getEconomico,
  getPeriodos,
  getRiesgo,
  getUmbralesRiesgo,
  postInvalidarCache,
} from "./controllers/dashboard.controller.ts";
import { eventosRegistrados } from "./controllers/dashboard.controller.ts";

// Rango de microservicios: 8880–8885.
const PORT = Number(Deno.env.get("PORT") ?? 8885);

const app = new Application();
const rt = new Router();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
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

// ── Tablero ─────────────────────────────────────────────────────────────────
// Rutas literales antes que "/:id" para que Oak no las capture.
rt.get("/dashboard", requireAuth(ROLES_LECTURA), getDashboard);
rt.get("/dashboard/academico", requireAuth(ROLES_LECTURA), getAcademico);
rt.get("/dashboard/asistencia", requireAuth(ROLES_LECTURA), getAsistencia);
rt.get("/dashboard/riesgo", requireAuth(ROLES_LECTURA), getRiesgo);
rt.get("/dashboard/economico", requireAuth(ROLES_LECTURA), getEconomico);
rt.get("/dashboard/periodos", requireAuth(ROLES_LECTURA), getPeriodos);
rt.get("/dashboard/umbrales", requireAuth(ROLES_LECTURA), getUmbralesRiesgo);
rt.post("/dashboard/cache/invalidar", requireAuth(ROLES_LECTURA), postInvalidarCache);

// ── Health Check ────────────────────────────────────────────────────────────
rt.get("/health", (ctx: Context) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceDashboard",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    soloLectura: true,
    features: [
      "Resumen ejecutivo de la página de inicio",
      "Avance de calificación por materia",
      "Indicadores de asistencia e inasistencia",
      "Estudiantes en riesgo",
      "Estimación económica y proyección de cobranza",
    ],
    vistas: eventosRegistrados().length,
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx: Context) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`ServiceDashboard corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /dashboard`);
console.log(`   GET    /dashboard/academico`);
console.log(`   GET    /dashboard/asistencia`);
console.log(`   GET    /dashboard/riesgo`);
console.log(`   GET    /dashboard/economico`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });
