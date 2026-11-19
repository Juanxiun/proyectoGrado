# ServiceDashboard

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** tableros y KPIs. Consolida datos académicos, asistencia, riesgo, económico y de periodos en endpoints agregados para el dashboard del frontend, con caché en Redis (`DASHBOARD_CACHE_TTL`) e invalidación manual; también expone los umbrales de riesgo. Recibe eventos por `POST /webhook` para invalidar caché cuando cambian los datos fuente.
- **Puerto:** 8885.
- **Tablas que usa** (`Esquems/BDmain.sql`): `usuarios`, `estudiantes`, `maestros`, `periodos_academicos`, `trimestres`, `materias`, `cursos`, `cursos_periodo`, `asignaciones_docentes`, `inscripciones`, `encargos`, `calificaciones`, `asistencia`, `pensiones`, `pagos`, `pago_pensiones`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `ROLES_LECTURA` | director, control, profesor, estudiante | todos los endpoints de tablero y `POST /dashboard/cache/invalidar` |
| Público | — | `POST /webhook` (gateway), `GET /health` |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook` | interno (gateway) |
| GET | `/dashboard` | lectura (director, control, profesor, estudiante) |
| GET | `/dashboard/academico` | lectura |
| GET | `/dashboard/asistencia` | lectura |
| GET | `/dashboard/riesgo` | lectura |
| GET | `/dashboard/economico` | lectura |
| GET | `/dashboard/periodos` | lectura |
| GET | `/dashboard/umbrales` | lectura |
| POST | `/dashboard/cache/invalidar` | lectura |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379` (stack externo al repo), esquema de `Esquems/BDmain.sql` y `.env` local (gitignored) con `JWT_SECRET` compartido (incluye `PERIODO_POR_DEFECTO`, `DASHBOARD_CACHE_TTL`, `ACADEMIC_SERVICE_URL`, `INTERNAL_PUSH_TOKEN`, `GATEWAY_PUBLIC_URL`).

```powershell
cd ServiceDashboard
deno task dev      # watch, puerto 8885
deno task start    # sin watch
```

`deno check server.ts` debe ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-dashboard
docker compose -p shalom_backend --env-file .env logs -f service-dashboard
```

Contenedor `shalom_service_dashboard`, puerto 8885, bind mount en `/app` con `deno task dev` (hot reload).
