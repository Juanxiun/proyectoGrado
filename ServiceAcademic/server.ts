import "./config/env.config.ts";

import { Application, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_GESTION, ROLES_LECTURA } from "./security/auth.ts";
import { handleWebhookEvent } from "./Controller/webhookHandler.ts";
import {
  createPeriodo,
  deletePeriodo,
  getPeriodo,
  listPeriodos,
  updatePeriodo,
} from "./Controller/periodos/periodos.ts";
import {
  createCurso,
  deleteCurso,
  getCurso,
  listCursos,
  updateCurso,
} from "./Controller/cursos/cursos.ts";
import {
  createMateria,
  deleteMateria,
  getMateria,
  listMaterias,
  updateMateria,
} from "./Controller/materias/materias.ts";
import { checkAndDeactivateExpiredPeriodos } from "./services/periodo.service.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8881);

const app = new Application();
const rt = new Router();

app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status} (${ms}ms)`);
});

rt.post("/webhook", handleWebhookEvent);

// ── Rutas Académicas Core ──────────────────────────────────────────────────
// Periodos Académicos (Apertura y Cierre de Años Lectivos)
rt.get("/periodos", requireAuth(ROLES_LECTURA), listPeriodos);
rt.get("/periodos/:id", requireAuth(ROLES_LECTURA), getPeriodo);
rt.post("/periodos", requireAuth(ROLES_GESTION), createPeriodo);
rt.put("/periodos/:id", requireAuth(ROLES_GESTION), updatePeriodo);
rt.delete("/periodos/:id", requireAuth(ROLES_GESTION), deletePeriodo);

// Cursos Base (Niveles, Grados y Paralelos)
rt.get("/cursos", requireAuth(ROLES_LECTURA), listCursos);
rt.get("/cursos/:id", requireAuth(ROLES_LECTURA), getCurso);
rt.post("/cursos", requireAuth(ROLES_GESTION), createCurso);
rt.put("/cursos/:id", requireAuth(ROLES_GESTION), updateCurso);
rt.delete("/cursos/:id", requireAuth(ROLES_GESTION), deleteCurso);

// Materias (Definición inmutable del plan de estudios)
rt.get("/materias", requireAuth(ROLES_LECTURA), listMaterias);
rt.get("/materias/:id", requireAuth(ROLES_LECTURA), getMateria);
rt.post("/materias", requireAuth(ROLES_GESTION), createMateria);
rt.put("/materias/:id", requireAuth(ROLES_GESTION), updateMateria);
rt.delete("/materias/:id", requireAuth(ROLES_GESTION), deleteMateria);

rt.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceAcademic",
    timestamp: new Date().toISOString(),
    version: "1.1.0",
    features: ["Periodos Academicos", "Cursos y Niveles", "Materias Inmutables", "Apertura y Cierre Anual"],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`ServiceAcademic corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /periodos`);
console.log(`   GET    /cursos`);
console.log(`   GET    /materias`);
console.log(`   GET    /health`);

// Tarea diaria: verificar periodos expirados y cambiar activo a false
checkAndDeactivateExpiredPeriodos().catch(console.error);
setInterval(() => {
  checkAndDeactivateExpiredPeriodos().catch(console.error);
}, 24 * 60 * 60 * 1000);

await app.listen({ port: PORT });

