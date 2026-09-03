import "./config/env.config.ts";

import { Application, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { createUsuario } from "./Controller/usuarios/create.ts";
import { updateUsuario } from "./Controller/usuarios/update.ts";
import { bajaUsuario } from "./Controller/usuarios/baja.ts";
import { deleteUsuario } from "./Controller/usuarios/delete.ts";
import { getUsuario, getUsuarios } from "./Controller/usuarios/views.ts";

import { login } from "./Controller/auth/login.ts";
import { verify2FA, resend2FA } from "./Controller/auth/twoFactor.ts";
import {
  logout,
  getMySessions,
  getUserSessionsById,
  revokeSession,
} from "./Controller/auth/session.ts";
import { requireAuth, getClaimsFromToken } from "./middleware/auth.ts";
import { addClient } from "./services/websocket.service.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);

const app = new Application();
const rt = new Router();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Latitude", "X-Longitude", "X-Zona", "X-Ciudad", "X-Pais"],
  }),
);

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status} (${ms}ms)`);
});

// Rutas de Usuarios (CRUD)
rt.get("/usuarios", requireAuth(["director", "control", "profesor"]), getUsuarios);
rt.get("/usuarios/:id", requireAuth(["director", "control", "profesor"]), getUsuario);
rt.post("/usuarios", requireAuth(["director", "control"]), createUsuario);
rt.put("/usuarios/:id", requireAuth(["director", "control"]), updateUsuario);
rt.patch("/usuarios/:id/baja", requireAuth(["director", "control"]), bajaUsuario);
rt.delete("/usuarios/:id", requireAuth(["director", "control"]), deleteUsuario);

// Rutas de Autenticación y 2FA
rt.post("/auth/login", login);
rt.post("/auth/verify-2fa", verify2FA);
rt.post("/auth/resend-2fa", resend2FA);
rt.post("/auth/logout", requireAuth(), logout);

// Rutas de Gestión de Sesiones y Auditoría de Dispositivos
rt.get("/auth/sessions/me", requireAuth(), getMySessions);
rt.get("/auth/sessions/user/:id", requireAuth(["director", "control", "profesor"]), getUserSessionsById);
rt.delete("/auth/sessions/:sessionId", requireAuth(["director", "control"]), revokeSession);

rt.get("/ws", async (ctx) => {
  const token = ctx.request.url.searchParams.get("token");
  const claims = token ? await getClaimsFromToken(token) : null;
  if (!claims) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token inválido o sesión inactiva" };
    return;
  }
  const socket = await ctx.upgrade();
  addClient(socket);
});

// Health Check
rt.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceUser",
    timestamp: new Date().toISOString(),
    version: "1.2.0",
    features: ["2FA", "Redis Session Cache", "Anti-Cheat Geo Distance", "Single Device Enforcement"],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`\n======================================================`);
console.log(`🚀 ServiceUser corriendo en http://localhost:${PORT}`);
console.log(`======================================================`);
console.log(`   Rutas disponibles:`);
console.log(`   POST   /auth/login`);
console.log(`   POST   /auth/verify-2fa`);
console.log(`   POST   /auth/resend-2fa`);
console.log(`   POST   /auth/logout`);
console.log(`   GET    /auth/sessions/me`);
console.log(`   GET    /auth/sessions/user/:id`);
console.log(`   DELETE /auth/sessions/:sessionId`);
console.log(`   GET    /usuarios`);
console.log(`   GET    /usuarios/:id`);
console.log(`   POST   /usuarios`);
console.log(`   PUT    /usuarios/:id`);
console.log(`   PATCH  /usuarios/:id/baja`);
console.log(`   DELETE /usuarios/:id`);
console.log(`   GET    /health`);
console.log(`======================================================\n`);

await app.listen({ port: PORT });
