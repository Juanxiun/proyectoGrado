# ServiceNotification

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** notificaciones del sistema. Único punto de fan-out que convierte eventos de dominio (canal Redis `notificaciones:eventos`) en notificaciones de UI mediante `services/reglas.service.ts` (catálogo de reglas, coincidencia por clave exacta, sin fallback). Maneja bandeja por usuario (listar, contar, leer, borrar), deduplicación de alertas, cálculo de riesgo y emisión manual; entrega a los clientes por SignalR a través del gateway (nunca abre un socket directo al frontend). Persiste notificaciones en Postgres y usa Redis para el bus de eventos.
- **Puerto:** 8884.
- **Tablas que usa** (`Esquems/BDmain.sql`): `roles`, `usuarios`, `estudiantes`, `maestros`, `periodos_academicos`, `materias`, `cursos`, `cursos_periodo`, `asignaciones_docentes`, `horarios`, `inscripciones`, `encargos`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `requireAuth()` (cualquier autenticado) | director, control, profesor, estudiante | bandeja: `GET /notificaciones`, `GET /notificaciones/conteo`, `GET /notificaciones/:id`, `POST /notificaciones/leer-todas`, `POST /notificaciones/:id/read`, `DELETE /notificaciones/:id` |
| `ROLES_GESTION` | director, control | `GET /notificaciones/reglas`, `POST /notificaciones/emitir`, `GET /eventos/estado` |
| Público | — | `POST /webhook` (gateway), `GET /health` |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook` | interno (gateway) |
| GET | `/notificaciones` | autenticado |
| GET | `/notificaciones/conteo` | autenticado |
| GET | `/notificaciones/reglas` | gestión (director, control) |
| GET | `/notificaciones/:id` | autenticado |
| POST | `/notificaciones/leer-todas` | autenticado |
| POST | `/notificaciones/:id/read` | autenticado |
| DELETE | `/notificaciones/:id` | autenticado |
| POST | `/notificaciones/emitir` | gestión (director, control) |
| GET | `/eventos/estado` | gestión (director, control) |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379` (stack externo al repo), esquema de `Esquems/BDmain.sql` y `.env` local (gitignored) con `JWT_SECRET`, `GATEWAY_PUBLIC_URL` e `INTERNAL_PUSH_TOKEN` compartidos.

```powershell
cd ServiceNotification
deno task dev      # watch, puerto 8884
deno task start    # sin watch
```

`deno check server.ts` debe ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-notification
docker compose -p shalom_backend --env-file .env logs -f service-notification
```

Contenedor `shalom_service_notification`, puerto 8884, bind mount en `/app` con `deno task dev` (hot reload). El compose le inyecta `GATEWAY_PUBLIC_URL=http://rest-api:5141` y `EVENTOS_CANAL=notificaciones:eventos`.
