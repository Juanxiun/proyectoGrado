// server.ts - ServiceHomework (LMS & Assessment Service)
import "./config/env.config.ts";

import { Application, Context, Next, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_DOCENTES, ROLES_LECTURA } from "./security/auth.ts";
import { handleWebhookEvent } from "./controllers/webhookHandler.ts";
import {
  createMaterial,
  deleteMaterial,
  getMaterial,
  listMateriales,
  updateMaterial,
} from "./controllers/materiales.controller.ts";
import {
  createEncargo,
  deleteEncargo,
  getEncargo,
  listEncargos,
  updateEncargo,
} from "./controllers/encargos.controller.ts";
import {
  bulkCalificaciones,
  createCalificacion,
  deleteCalificacion,
  getCalificacion,
  listCalificaciones,
  updateCalificacion,
} from "./controllers/calificaciones.controller.ts";
import {
  bulkAsistencias,
  createAsistencia,
  deleteAsistencia,
  getAsistencia,
  listAsistencias,
  updateAsistencia,
} from "./controllers/asistencia.controller.ts";
import {
  createEntrega,
  deleteEntrega,
  getEntrega,
  listEntregas,
} from "./controllers/entregas.controller.ts";
import {
  listNotificaciones,
  readNotificacion,
} from "./controllers/notificaciones.controller.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8883);

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

// ── Materia Materiales (Subida de archivos / recursos a MinIO) ─────────────
rt.get("/materiales", requireAuth(ROLES_LECTURA), listMateriales);
rt.get("/materiales/:id", requireAuth(ROLES_LECTURA), getMaterial);
rt.post("/materiales", requireAuth(ROLES_DOCENTES), createMaterial);
rt.put("/materiales/:id", requireAuth(ROLES_DOCENTES), updateMaterial);
rt.delete("/materiales/:id", requireAuth(ROLES_DOCENTES), deleteMaterial);

// ── Encargos (Tareas, Prácticas, Evaluaciones) ─────────────────────────────
rt.get("/encargos", requireAuth(ROLES_LECTURA), listEncargos);
rt.get("/encargos/:id", requireAuth(ROLES_LECTURA), getEncargo);
rt.post("/encargos", requireAuth(ROLES_DOCENTES), createEncargo);
rt.put("/encargos/:id", requireAuth(ROLES_DOCENTES), updateEncargo);
rt.delete("/encargos/:id", requireAuth(ROLES_DOCENTES), deleteEncargo);

// ── Entregas (Deberes / Tareas de Estudiantes) ─────────────────────────────
rt.get("/entregas", requireAuth(ROLES_LECTURA), listEntregas);
rt.get("/entregas/:id", requireAuth(ROLES_LECTURA), getEntrega);
rt.post("/entregas", requireAuth(ROLES_LECTURA), createEntrega);
rt.delete("/entregas/:id", requireAuth(ROLES_LECTURA), deleteEntrega);

// ── Calificaciones (Evaluación y notas por encargo) ────────────────────────
rt.get("/calificaciones", requireAuth(ROLES_LECTURA), listCalificaciones);
rt.get("/calificaciones/:id", requireAuth(ROLES_LECTURA), getCalificacion);
rt.post("/calificaciones", requireAuth(ROLES_DOCENTES), createCalificacion);
rt.post("/calificaciones/bulk", requireAuth(ROLES_DOCENTES), bulkCalificaciones);
rt.put("/calificaciones/:id", requireAuth(ROLES_DOCENTES), updateCalificacion);
rt.delete("/calificaciones/:id", requireAuth(ROLES_DOCENTES), deleteCalificacion);

// ── Asistencia (Control y seguimiento diario) ──────────────────────────────
rt.get("/asistencia", requireAuth(ROLES_LECTURA), listAsistencias);
rt.get("/asistencia/:id", requireAuth(ROLES_LECTURA), getAsistencia);
rt.post("/asistencia", requireAuth(ROLES_DOCENTES), createAsistencia);
rt.post("/asistencia/bulk", requireAuth(ROLES_DOCENTES), bulkAsistencias);
rt.put("/asistencia/:id", requireAuth(ROLES_DOCENTES), updateAsistencia);
rt.delete("/asistencia/:id", requireAuth(ROLES_DOCENTES), deleteAsistencia);

// ── Notificaciones en Redis (TTL 30 días + Tracking) ───────────────────────
rt.get("/notificaciones", requireAuth(), listNotificaciones);
rt.post("/notificaciones/:id/read", requireAuth(), readNotificacion);

// ── Health Check ───────────────────────────────────────────────────────────
rt.get("/health", (ctx: Context) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceHomework",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    features: [
      "Gestión de Encargos / Tareas",
      "Subida de Materiales y Archivos a MinIO (límite 150MB, PDF/Word/Excel)",
      "Registro y Evaluación de Calificaciones",
      "Control de Asistencia Diaria",
    ],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

app.use((ctx: Context) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`ServiceHomework corriendo en http://localhost:${PORT}`);
console.log(`   POST   /webhook`);
console.log(`   GET    /materiales`);
console.log(`   GET    /encargos`);
console.log(`   GET    /calificaciones`);
console.log(`   GET    /asistencia`);
console.log(`   GET    /health`);

await app.listen({ port: PORT });
