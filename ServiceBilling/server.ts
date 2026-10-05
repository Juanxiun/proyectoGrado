import "./config/env.config.ts";

import { Application, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";

import { requireAuth, ROLES_DIRECTOR_CONTROL, ROLES_TODOS, ROLES_SIN_PROFESOR } from "./middleware/auth.ts";
import { handleWebhookAcademic, handleWebhookUser, handleWebhookEnrollment, handleWebhookHomework, handleWebhookDashboard } from "./Controller/webhookHandler.ts";
import {
  listPlanos,
  getPlanPago,
  createPlanPago,
  updatePlanPago,
  deletePlanPago,
  listCuotasPlan,
  updateCuota,
  listPagosEstudiante,
  registrarPago,
  getDeudaEstudiante,
  getDeudaEstudiantesPeriodo,
} from "./Controller/planos/planos.ts";

const PORT = Number(Deno.env.get("PORT") ?? 8886);

const app = new Application();
const rt = new Router();

// middleware -> permitir cors
app.use(
  oakCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// middleware -> registrar peticiones
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} → ${ctx.response.status} (${ms}ms)`);
});

// rutas -> registrar webhooks sin auth
rt.post("/webhook/academic", handleWebhookAcademic);
rt.post("/webhook/user", handleWebhookUser);
rt.post("/webhook/enrollment", handleWebhookEnrollment);
rt.post("/webhook/homework", handleWebhookHomework);
rt.post("/webhook/dashboard", handleWebhookDashboard);

// ruta -> listar planes pago
rt.get("/planos", requireAuth(ROLES_TODOS), listPlanos);

// ruta -> obtener plan pago
rt.get("/planos/:id", requireAuth(ROLES_TODOS), getPlanPago);

// ruta -> crear plan pago
rt.post("/planos", requireAuth(ROLES_DIRECTOR_CONTROL), createPlanPago);

// ruta -> actualizar plan pago
rt.put("/planos/:id", requireAuth(ROLES_DIRECTOR_CONTROL), updatePlanPago);

// ruta -> anular plan pago
rt.delete("/planos/:id", requireAuth(ROLES_DIRECTOR_CONTROL), deletePlanPago);

// ruta -> listar cuotas plan
rt.get("/cuotas", requireAuth(ROLES_TODOS), listCuotasPlan);

// ruta -> actualizar cuota
rt.put("/cuotas/:id", requireAuth(ROLES_DIRECTOR_CONTROL), updateCuota);

// ruta -> listar pagos estudiante
rt.get("/pagos", requireAuth(ROLES_TODOS), listPagosEstudiante);

// ruta -> registrar pago
rt.post("/pagos", requireAuth(ROLES_DIRECTOR_CONTROL), registrarPago);

// ruta -> consultar deuda estudiante
rt.get("/estudiantes/:id/deuda", requireAuth(ROLES_SIN_PROFESOR), getDeudaEstudiante);

// ruta -> listar deudas periodo
rt.get("/periodos/:id/DeudaEstudiantes", requireAuth(ROLES_DIRECTOR_CONTROL), getDeudaEstudiantesPeriodo);

// ruta -> verificar salud
rt.get("/health", (ctx) => {
  ctx.response.status = 200;
  ctx.response.body = {
    status: "ok",
    service: "ServiceBilling",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    features: [
      "Gestión de planes de pago",
      "Control de cuotas estudiantiles",
      "Registro de pagos",
      "Notificación de morosidad (≥ 2 cuotas)",
    ],
  };
});

app.use(rt.routes());
app.use(rt.allowedMethods());

// middleware -> responder ruta inexistente
app.use((ctx) => {
  ctx.response.status = 404;
  ctx.response.body = { error: "Ruta no encontrada" };
});

console.log(`ServiceBilling corriendo en http://localhost:${PORT}`);
console.log(`   GET    /health`);
console.log(`   GET    /planos?periodo_id=X&nivel=X&page=X&limit=X`);
console.log(`   GET    /planos/:id`);
console.log(`   POST   /planos`);
console.log(`   PUT    /planos/:id`);
console.log(`   DELETE /planos/:id`);
console.log(`   GET    /cuotas?plan_id=X`);
console.log(`   PUT    /cuotas/:id`);
console.log(`   GET    /pagos?estudiante_id=X`);
console.log(`   POST   /pagos`);
console.log(`   GET    /estudiantes/:id/deuda`);
console.log(`   GET    /periodos/:id/DeudaEstudiantes`);
console.log(`   POST   /webhook/academic`);
console.log(`   POST   /webhook/user`);
console.log(`   POST   /webhook/enrollment`);
console.log(`   POST   /webhook/homework`);
console.log(`   POST   /webhook/dashboard`);

await app.listen({ port: PORT });