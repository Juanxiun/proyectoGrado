# ServiceBilling

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** gestión económica. Administra planes de pago (CRUD), cuotas de los planes, pagos (con `registrarPago()`), deuda por estudiante, deuda por periodo y KPIs económicos (`/economia/kpis`, lista de estudiantes por deuda). Al registrar un pago, si un estudiante queda con 2 o más cuotas pendientes publica el evento `cuotas.sobre_limite` en el canal Redis `notificaciones:eventos`. Recibe webhooks de otros servicios (`/webhook/academic|user|enrollment|homework|dashboard`), p. ej. para crear planes por defecto al crearse un periodo.
- **Puerto:** 8886.
- **Tablas que usa** (`Esquems/BDmain.sql`): `planes_pago`, `cuotas_plan_pago`, `pensiones`, `pagos`, `pago_pensiones`, además de `usuarios`, `estudiantes`, `periodos_academicos`, `inscripciones`, `cursos`, `cursos_periodo` para nombres y agregados. No crea tablas ni columnas: el esquema es único y lo define `Esquems/BDmain.sql`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `ROLES_TODOS` | director, control, profesor, estudiante | GET de `/planos`, `/planos/:id`, `/cuotas`, `/pagos` |
| `ROLES_DIRECTOR_CONTROL` | director, control | CRUD de planes, `PUT /cuotas/:id`, `POST /pagos`, `/economia/*`, `/periodos/:id/DeudaEstudiantes` |
| `ROLES_SIN_PROFESOR` | director, control, estudiante | `GET /estudiantes/:id/deuda` — el estudiante **solo** sobre su propio `sub` (si no, 403) |
| Público | — | `GET /health` |
| Sin JWT (interno) | gateway | `POST /webhook/*` |

**Política de seguridad (no debilitar):** los profesores nunca ven datos económicos y un estudiante solo ve su propia deuda; la validación vive en los guards de ruta, no en las consultas.

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook/academic` · `/webhook/user` · `/webhook/enrollment` · `/webhook/homework` · `/webhook/dashboard` | interno (gateway) |
| GET | `/planos` | todos (lectura) |
| GET | `/planos/:id` | todos (lectura) |
| POST / PUT / DELETE | `/planos`, `/planos/:id` | director, control |
| GET | `/cuotas` | todos (lectura) |
| PUT | `/cuotas/:id` | director, control |
| GET | `/pagos` | todos (lectura) |
| POST | `/pagos` | director, control |
| GET | `/economia/kpis` | director, control |
| GET | `/economia/estudiantes` | director, control |
| GET | `/economia/estudiantes/:id` | director, control |
| GET | `/estudiantes/:id/deuda` | director, control, estudiante (solo el propio) |
| GET | `/periodos/:id/DeudaEstudiantes` | director, control |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379` (stack externo al repo), esquema de `Esquems/BDmain.sql` (seed económico opcional: `Esquems/datos_economia.sql`) y `.env` local (gitignored) con `JWT_SECRET`, `EVENTOS_CANAL` y `GATEWAY_PUBLIC_URL` compartidos.

```powershell
cd ServiceBilling
deno task dev      # watch, puerto 8886
deno task start    # sin watch
deno task check    # deno check server.ts
deno task test     # sin tests aqui -> sale con "No test modules found"
```

`deno check server.ts` debe ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-billing
docker compose -p shalom_backend --env-file .env logs -f service-billing
```

Contenedor `shalom_service_billing`, puerto 8886, bind mount en `/app` con `deno task dev` (hot reload). El gateway lo alcanza como `http://service-billing:8886` (`Services__BillingService`).
