# ServiceHomework

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![MinIO](https://img.shields.io/badge/MinIO-C72E49?logo=minio&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** aula y evaluación. Gestiona materiales (CRUD con archivos en MinIO; al crear uno envía `content.created` a `service-llms` con el header `x-webhook-secret`), encargos/tareas, entregas de estudiantes, calificaciones (individual y masiva) y asistencia (individual y masiva). Publica eventos en Redis para notificaciones.
- El flujo estudiante expone `GET /aprendizaje/materiales/:id`, `POST /aprendizaje/materiales/:id/resumen`, `POST /aprendizaje/materiales/:id/reto` y `POST /aprendizaje/materiales/:id/reto/:quizId/completar`. Solo acepta JWT de estudiante; el secreto LLM permanece en el servicio.
- **Puerto:** 8883.
- **Tablas que usa** (`Esquems/BDmain.sql`): `usuarios`, `usuario_documentos`, `estudiantes`, `maestros`, `materias`, `cursos`, `cursos_periodo`, `asignaciones_docentes`, `materia_materiales`, `encargos`, `encargo_materiales`, `encargo_entregas`, `calificaciones`, `asistencia`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `ROLES_LECTURA` | director, control, profesor, estudiante | GET de materiales, encargos, entregas, calificaciones y asistencia; `POST/DELETE /entregas` (el estudiante entrega) |
| `ROLES_DOCENTES` | profesor, director, control | CRUD de materiales, encargos, calificaciones (incl. `/bulk`) y asistencia (incl. `/bulk`) |
| Público | — | `POST /webhook` (gateway), `GET /health` |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook` | interno (gateway) |
| GET | `/materiales`, `/materiales/:id` | lectura |
| POST / PUT / DELETE | `/materiales`, `/materiales/:id` | docentes |
| GET | `/encargos`, `/encargos/:id` | lectura |
| POST / PUT / DELETE | `/encargos`, `/encargos/:id` | docentes |
| GET | `/entregas`, `/entregas/:id` | lectura |
| POST / DELETE | `/entregas`, `/entregas/:id` | lectura |
| GET | `/calificaciones`, `/calificaciones/:id` | lectura |
| POST | `/calificaciones`, `/calificaciones/bulk` | docentes |
| PUT / DELETE | `/calificaciones/:id` | docentes |
| GET | `/asistencia`, `/asistencia/:id` | lectura |
| POST | `/asistencia`, `/asistencia/bulk` | docentes |
| PUT / DELETE | `/asistencia/:id` | docentes |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379`, MinIO `9000` (stack externo al repo), esquema de `Esquems/BDmain.sql` y `.env` local (gitignored) con `JWT_SECRET` compartido. Para el envío a LLM: `LLM_WEBHOOK_SECRET` y `LLM_SERVICE_URL` apuntando a `service-llms`.

```powershell
cd ServiceHomework
deno task dev      # watch, puerto 8883
deno task start    # sin watch
```

`deno check server.ts` debe ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-homework
docker compose -p shalom_backend --env-file .env logs -f service-homework
```

Contenedor `shalom_service_homework`, puerto 8883, bind mount en `/app` con `deno task dev` (hot reload). El compose le inyecta `LLM_SERVICE_URL=http://service-llms:8890`.
