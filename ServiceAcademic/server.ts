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
import {
  activatePeriodo,
  deactivatePeriodo,
  clonePeriodo,
  generatePaymentPlan,
  generatePaymentPlanForPeriod,
  generateSchedule,
  generateScheduleForPeriod,
  generateStructure,
  getAulas,
  getPeriodoEstado,
  getPeriodoValidacion,
  listPeriodoTrimestres,
  listHorarios,
  listMallas,
  listPlanes,
  listTrimestres,
  postAula,
  postHorarioManual,
  postMalla,
} from "./Controller/gestion/gestion.ts";

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
// Configuración, clonación y activación de la gestión
rt.post("/periodos/:id/clonar", requireAuth(ROLES_GESTION), clonePeriodo);
rt.post("/periodos/:id/clone", requireAuth(ROLES_GESTION), clonePeriodo);
rt.post("/periodos/:id/generar-estructura", requireAuth(ROLES_GESTION), generateStructure);
rt.post("/periodos/:id/estructura/generar", requireAuth(ROLES_GESTION), generateStructure);
rt.post("/periodos/:id/generar-cursos", requireAuth(ROLES_GESTION), generateStructure);
rt.post("/periodos/:id/generar-horarios", requireAuth(ROLES_GESTION), generateSchedule);
rt.post("/periodos/:id/horarios/generar", requireAuth(ROLES_GESTION), generateSchedule);
rt.post("/periodos/:id/horarios/manual", requireAuth(ROLES_GESTION), postHorarioManual);
rt.post("/periodos/:id/generar-plan-pagos", requireAuth(ROLES_GESTION), generatePaymentPlan);
rt.post("/periodos/:id/plan-pagos/generar", requireAuth(ROLES_GESTION), generatePaymentPlan);
rt.post("/periodos/:id/activar", requireAuth(ROLES_GESTION), activatePeriodo);
rt.post("/periodos/:id/desactivar", requireAuth(ROLES_GESTION), deactivatePeriodo);
rt.get("/periodos/:id/estado", requireAuth(ROLES_LECTURA), getPeriodoEstado);
rt.get("/periodos/:id/readiness", requireAuth(ROLES_LECTURA), getPeriodoEstado);
rt.get("/periodos/:id/validacion", requireAuth(ROLES_LECTURA), getPeriodoValidacion);
rt.get("/periodos/:id/validar", requireAuth(ROLES_LECTURA), getPeriodoValidacion);
rt.get("/periodos/:id/trimestres", requireAuth(ROLES_LECTURA), listPeriodoTrimestres);

// Listados de configuración de la gestión
rt.get("/trimestres", requireAuth(ROLES_LECTURA), listTrimestres);
rt.get("/horarios", requireAuth(ROLES_LECTURA), listHorarios);
rt.post("/horarios/generar", requireAuth(ROLES_GESTION), generateScheduleForPeriod);
rt.post("/horarios/manual", requireAuth(ROLES_GESTION), postHorarioManual);
rt.get("/mallas-curriculares", requireAuth(ROLES_LECTURA), listMallas);
rt.post("/mallas-curriculares", requireAuth(ROLES_GESTION), postMalla);
rt.get("/planes-pago", requireAuth(ROLES_LECTURA), listPlanes);
rt.post("/planes-pago/generar", requireAuth(ROLES_GESTION), generatePaymentPlanForPeriod);
rt.get("/aulas", requireAuth(ROLES_LECTURA), getAulas);
rt.post("/aulas", requireAuth(ROLES_GESTION), postAula);

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
    features: ["Gestion academica", "Trimestres", "Mallas curriculares", "Turnos y aulas", "Horarios", "Planes de pago", "Activacion controlada"],
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
console.log(`   POST   /periodos/:id/generar-estructura`);
console.log(`   POST   /periodos/:id/generar-horarios`);
console.log(`   POST   /periodos/:id/generar-plan-pagos`);
console.log(`   POST   /periodos/:id/activar`);
console.log(`   GET    /health`);

// Tarea diaria: verificar periodos expirados y cambiar activo a false
checkAndDeactivateExpiredPeriodos().catch(console.error);
setInterval(() => {
  checkAndDeactivateExpiredPeriodos().catch(console.error);
}, 24 * 60 * 60 * 1000);

await app.listen({ port: PORT });

