// archivo -> servidor gamificacion
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";
import { WebSocketServer } from "ws";

import { requireEstudiante } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import { routes } from "./controllers/gamificacion.controller.ts";
import { initWebSocketServer, initRedisListener } from "./websocket/handler.ts";
import { getRedis, closeRedis } from "./connects/Redis/redis.ts";
import { closePool } from "./connects/Database/connect.ts";

// config -> puerto servicio
const PORT = Number(Deno.env.get("PORT") ?? 8887);

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

// rutas -> webhook gateway
rt.post("/webhook", handleWebhookEvent);

// rutas -> gamificacion (solo estudiantes)
for (const route of routes) {
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
    service: "ServiceGamification",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: [
      "Racha diaria con 50% o más de aciertos",
      "Puntos individuales y globales",
      "Límite de 20 puntos base y bono de 10 por desafíos",
      "Informe de aprendizaje con ServiceAcademicLLMs",
      "Insignias y trofeos automaticos",
      "Tienda de recompensas",
      "Ranking por paralelos A y B",
      "WebSockets tiempo real",
      "Integracion ServiceAcademicLLMs",
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

// handler -> conexiones ws upgrade
const upgradeHandler = async (_req: any, socket: any, _head: any) => {
  console.log("[WS] Upgrade request recibido");
  socket.destroy();
};

// proceso -> apagado del servidor
const shutdown = async () => {
  console.log("[Shutdown] Cerrando conexiones...");
  await closeRedis();
  await closePool();
  wss.close();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

console.log(`ServiceGamification corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /gamificacion/resumen`);
console.log(`   POST   /gamificacion/actividad`);
console.log(`   POST   /gamificacion/racha/salvar`);
console.log(`   POST   /gamificacion/pista`);
console.log(`   GET    /gamificacion/tienda`);
console.log(`   POST   /gamificacion/tienda/canjear`);
console.log(`   GET    /gamificacion/ranking`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });
