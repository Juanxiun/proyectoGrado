import "./config/env.config.ts";

import { Application, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { createUsuario } from "./Controller/usuarios/create.ts";
import { updateUsuario } from "./Controller/usuarios/update.ts";
import { deleteUsuario } from "./Controller/usuarios/delete.ts";
import { getUsuario, getUsuarios } from "./Controller/usuarios/views.ts";

import { login } from "./Controller/auth/login.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8000);

const app = new Application();
const rt = new Router();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status} (${ms}ms)`);
});

rt.get("/usuarios", getUsuarios);
rt.get("/usuarios/:id", getUsuario);
rt.post("/usuarios", createUsuario);
rt.put("/usuarios/:id", updateUsuario);
rt.delete("/usuarios/:id", deleteUsuario);

rt.post("/auth/login", login);

rt.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceUser",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`\nServiceUser corriendo en http://localhost:${PORT}`);
console.log(`   Rutas disponibles:`);
console.log(`   POST   /auth/login`);
console.log(`   GET    /usuarios`);
console.log(`   GET    /usuarios/:id`);
console.log(`   POST   /usuarios`);
console.log(`   PUT    /usuarios/:id`);
console.log(`   DELETE /usuarios/:id`);
console.log(`   GET    /health\n`);

await app.listen({ port: PORT });
