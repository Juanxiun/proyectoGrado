# ServiceUser

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** servicio de autenticación y gestión de usuarios. Emite el JWT (los demás servicios solo lo verifican), controla login con 2FA (verify/resend), cambio y restablecimiento de contraseña, sesiones/dispositivos (listar y revocar), CRUD de usuarios, baja lógica, carga de documentos/fotos a MinIO y correos vía Brevo. Escucha eventos entrantes por `POST /webhook` y publica eventos de usuario en Redis.
- **Puerto:** 8880.
- **Tablas que usa** (`Esquems/BDmain.sql`): `roles`, `usuarios`, `usuario_cuenta`, `usuario_documentos`, `usuario_direcciones`, `usuario_contactos`, `estudiantes`, `apoderados`, `estudiante_apoderado`, `maestros`, `maestro_materias`, `periodos_academicos`, `materias`, `cursos`, `cursos_periodo`, `asignaciones_docentes`, `curso_asesor`, `inscripciones`.

## Roles permitidos

Catálogo de la tabla `roles`: `director`, `control`, `profesor`, `estudiante`, `apoderado`, `gerencia` (los guards operan con los cuatro primeros).

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| Público (sin token) | — | `POST /auth/login`, `POST /auth/verify-2fa`, `POST /auth/resend-2fa`, `GET /health` |
| `requireAuth()` (cualquier autenticado) | director, control, profesor, estudiante | `GET/PUT /usuarios/:id`, `POST /auth/change-password`, `POST /auth/logout`, `GET /auth/sessions/me` |
| `["director","control","profesor"]` | director, control, profesor | `GET /usuarios`, `GET /auth/sessions/user/:id` |
| `["director","control"]` | director, control | `POST /usuarios`, `PATCH /usuarios/:id/baja`, `DELETE /usuarios/:id`, `DELETE /auth/sessions/:sessionId` |
| Token interno del gateway | servicios | `POST /webhook` |
| Token por query (`?token=`) | — | `GET /ws` (upgrade a WebSocket) |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| GET | `/usuarios` | director, control, profesor |
| GET | `/usuarios/:id` | autenticado |
| POST | `/usuarios` | director, control |
| PUT | `/usuarios/:id` | autenticado |
| PATCH | `/usuarios/:id/baja` | director, control |
| DELETE | `/usuarios/:id` | director, control |
| POST | `/auth/login` | público |
| POST | `/auth/verify-2fa` | público |
| POST | `/auth/resend-2fa` | público |
| POST | `/auth/change-password` | autenticado |
| POST | `/auth/logout` | autenticado |
| GET | `/auth/sessions/me` | autenticado |
| GET | `/auth/sessions/user/:id` | director, control, profesor |
| DELETE | `/auth/sessions/:sessionId` | director, control |
| POST | `/webhook` | interno (gateway) |
| GET | `/ws` | token por query |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: infra externa al repo (Postgres `127.0.0.1:5432`, Redis `6379`, MinIO `9000`), esquema cargado desde `Esquems/BDmain.sql` y un `.env` local en la carpeta (gitignored) con, entre otras, `JWT_SECRET` idéntico al del resto de servicios.

```powershell
cd ServiceUser
deno task dev      # watch, puerto 8880
deno task start    # sin watch
```

`deno check server.ts` debe ejecutarse con la carpeta del servicio como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-user
docker compose -p shalom_backend --env-file .env logs -f service-user
```

El contenedor se llama `shalom_service_user`, publica el 8880 y monta la carpeta en `/app` con `deno task dev` (hot reload). El entorno del contenedor lo define el `environment:` del compose (los `${VAR}` vienen del `.env` de la raíz).
