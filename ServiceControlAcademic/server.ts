// archivo -> servidor control academico
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";
import { WebSocketServer } from "ws";

import { requireDocente, requireControlAcademico } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import { routes as asistenciaRoutes } from "./controllers/asistencia.controller.ts";
import { routes as calificacionesRoutes } from "./controllers/calificaciones.controller.ts";
import { routes as temasRoutes } from "./controllers/temas.controller.ts";
import { routes as examenesRoutes } from "./controllers/examenes.controller.ts";
import { routes as reportesRoutes } from "./controllers/reportes.controller.ts";
import { initRedisListener } from "./websocket/handler.ts";
import { getRedis, closeRedis } from "./connects/Redis/redis.ts";
import { closePool } from "./connects/Database/connect.ts";

// config -> puerto servicio
const PORT = Number(Deno.env.get("PORT") ?? 8888);

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
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} \u2192 ${ctx.response.status} (${ms}ms)`);
});

// rutas -> webhook gateway
rt.post("/webhook", handleWebhookEvent);

// rutas -> control academico (docentes + gestion)
const allRoutes = [
  ...asistenciaRoutes,
  ...calificacionesRoutes,
  ...temasRoutes,
  ...examenesRoutes,
  ...reportesRoutes,
];

for (const route of allRoutes) {
  const middlewares = [...(route.middleware ?? [])];
  const handlers = [...middlewares, route.handler];
  if (route.method === "GET") {
    rt.get(route.path, handlers[0], handlers[1]);
  } else if (route.method === "POST") {
    rt.post(route.path, handlers[0], handlers[1]);
  } else if (route.method === "PUT") {
    rt.put(route.path, handlers[0], handlers[1]);
  } else if (route.method === "DELETE") {
    rt.delete(route.path, handlers[0], handlers[1]);
  }
}

// ruta -> health check
rt.get("/health", (ctx: Context) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceControlAcademico",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: [
      "Control de asistencia con validaci\u00f3n horaria",
      "Gesti\u00f3n de calificaciones por malla curricular",
      "Temas y avance de malla curricular",
      "Ex\u00e1menes parciales con 6 tipos de preguntas",
      "Reportes de riesgo, asistencia, calificaciones",
      "WebSockets tiempo real",
      "Integraci\u00f3n con ServiceAcademicLLMs",
      "Webhooks desde servicios hermanos",
    ],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx: Context) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

// websocket -> servidor ws integrado
const wss = new WebSocketServer({ noServer: true });

// graceful shutdown
const shutdown = async () => {
  console.log("[Shutdown] Cerrando conexiones...");
  await closeRedis();
  await closePool();
  wss.close();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// iniciar listener redis para eventos
initRedisListener().catch((err) => {
  console.error("[RedisListener] Error iniciando:", err);
});

console.log(`ServiceControlAcademico corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /asistencia`);
console.log(`   POST   /asistencia`);
console.log(`   POST   /asistencia/bulk`);
console.log(`   GET    /calificaciones`);
console.log(`   POST   /calificaciones`);
console.log(`   POST   /calificaciones/bulk`);
console.log(`   GET    /temas`);
console.log(`   POST   /temas`);
console.log(`   GET    /examenes`);
console.log(`   POST   /examenes`);
console.log(`   POST   /examenes/responder`);
console.log(`   GET    /reportes/asistencia`);
console.log(`   GET    /reportes/calificaciones`);
console.log(`   GET    /reportes/riesgo`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });