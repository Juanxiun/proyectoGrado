// server.ts - ServiceEnrollment
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_GESTION, ROLES_LECTURA } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import {
  createCursoPeriodo,
  deleteCursoPeriodo,
  getCursoPeriodo,
  listCursosPeriodo,
  updateCursoPeriodo,
} from "./controllers/cursosPeriodo.controller.ts";
import {
  createInscripcion,
  deleteInscripcion,
  getInscripcion,
  listInscripciones,
  retirarInscripcion,
  updateInscripcion,
} from "./controllers/inscripciones.controller.ts";
import {
  createAsignacion,
  deleteAsignacion,
  getAsignacion,
  listAsignaciones,
  updateAsignacion,
} from "./controllers/asignaciones.controller.ts";
import {
  createAsesor,
  deleteAsesor,
  getAsesor,
  listAsesores,
  updateAsesor,
} from "./controllers/asesores.controller.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8882);

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

// ── Webhook ────────────────────────────────────────────────────────────────
rt.post("/webhook", handleWebhookEvent);

// ── Cursos Periodo (Apertura de cursos por año lectivo) ─────────────────────
rt.get("/cursos-periodo", requireAuth(ROLES_LECTURA), listCursosPeriodo);
rt.get("/cursos-periodo/:id", requireAuth(ROLES_LECTURA), getCursoPeriodo);
rt.post("/cursos-periodo", requireAuth(ROLES_GESTION), createCursoPeriodo);
rt.put("/cursos-periodo/:id", requireAuth(ROLES_GESTION), updateCursoPeriodo);
rt.delete("/cursos-periodo/:id", requireAuth(ROLES_GESTION), deleteCursoPeriodo);

// ── Inscripciones (Matriculación de estudiantes por año) ───────────────────
rt.get("/inscripciones", requireAuth(ROLES_LECTURA), listInscripciones);
rt.get("/inscripciones/:id", requireAuth(ROLES_LECTURA), getInscripcion);
rt.post("/inscripciones", requireAuth(ROLES_GESTION), createInscripcion);
rt.put("/inscripciones/:id", requireAuth(ROLES_GESTION), updateInscripcion);
rt.patch("/inscripciones/:id/retirar", requireAuth(ROLES_GESTION), retirarInscripcion);
rt.delete("/inscripciones/:id", requireAuth(ROLES_GESTION), deleteInscripcion);

// ── Asignaciones Docentes (Carga horaria y materia a profesores) ───────────
rt.get("/asignaciones", requireAuth(ROLES_LECTURA), listAsignaciones);
rt.get("/asignaciones/:id", requireAuth(ROLES_LECTURA), getAsignacion);
rt.post("/asignaciones", requireAuth(ROLES_GESTION), createAsignacion);
rt.put("/asignaciones/:id", requireAuth(ROLES_GESTION), updateAsignacion);
rt.delete("/asignaciones/:id", requireAuth(ROLES_GESTION), deleteAsignacion);

// ── Asesores de Curso (Asignación de asesores/tutores de curso) ────────────
rt.get("/asesores", requireAuth(ROLES_LECTURA), listAsesores);
rt.get("/asesores/:id", requireAuth(ROLES_LECTURA), getAsesor);
rt.post("/asesores", requireAuth(ROLES_GESTION), createAsesor);
rt.put("/asesores/:id", requireAuth(ROLES_GESTION), updateAsesor);
rt.delete("/asesores/:id", requireAuth(ROLES_GESTION), deleteAsesor);

// ── Health Check ───────────────────────────────────────────────────────────
rt.get("/health", (ctx: Context) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceEnrollment",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: [
      "Matriculación de estudiantes por año",
      "Cursos por periodo académico",
      "Asignación de carga horaria y materias a docentes",
      "Asignación de asesores de curso",
    ],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx: Context) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`ServiceEnrollment corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /cursos-periodo`);
console.log(`   GET    /inscripciones`);
console.log(`   GET    /asignaciones`);
console.log(`   GET    /asesores`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });
