# ServiceEnrollment

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** matrícula e inscripciones. Administra cursos por periodo (`cursos-periodo`), inscripciones (alta, edición, retiro, borrado), solicitudes de inscripción del estudiante (aprobar/rechazar), habilitación de inscripción por estudiante, asignaciones docentes por materia y asesores de curso. Publica eventos en Redis y consume el webhook entrante del gateway.
- **Puerto:** 8882.
- **Tablas que usa** (`Esquems/BDmain.sql`): `usuarios`, `usuario_documentos`, `estudiantes`, `apoderados`, `estudiante_apoderado`, `maestros`, `maestro_materias`, `periodos_academicos`, `turnos`, `materias`, `cursos`, `cursos_periodo`, `mallas_curriculares`, `asignaciones_docentes`, `curso_asesor`, `solicitudes_inscripcion`, `inscripciones`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `ROLES_LECTURA` | director, control, profesor, estudiante | GET de cursos-periodo, inscripciones, asignaciones y asesores |
| `ROLES_GESTION` | director, control | CRUD de cursos-periodo/inscripciones/asignaciones/asesores, aprobar y rechazar solicitudes, retirar |
| `requireAuth()` (cualquier autenticado) | director, control, profesor, estudiante | `POST /inscripciones/solicitud`, `GET /inscripciones/solicitudes` |
| `["estudiante"]` | estudiante | `POST /inscripciones/habilitar` |
| Público | — | `POST /webhook` (gateway), `GET /health` |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook` | interno (gateway) |
| GET / POST / PUT / DELETE | `/cursos-periodo`, `/cursos-periodo/:id` | lectura (GET) / gestión (escritura) |
| GET | `/inscripciones`, `/inscripciones/:id` | lectura |
| GET | `/inscripciones/solicitudes` | autenticado |
| POST | `/inscripciones/solicitud` | autenticado |
| POST | `/inscripciones/habilitar` | estudiante |
| PATCH | `/inscripciones/solicitudes/:id/aprobar` | gestión |
| PATCH | `/inscripciones/solicitudes/:id/rechazar` | gestión |
| POST / PUT / DELETE | `/inscripciones`, `/inscripciones/:id` | gestión |
| PATCH | `/inscripciones/:id/retirar` | gestión |
| GET / POST / PUT / DELETE | `/asignaciones`, `/asignaciones/:id` | lectura (GET) / gestión (escritura) |
| GET / POST / PUT / DELETE | `/asesores`, `/asesores/:id` | lectura (GET) / gestión (escritura) |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379` (stack externo al repo), esquema de `Esquems/BDmain.sql` y `.env` local (gitignored) con `JWT_SECRET` compartido.

```powershell
cd ServiceEnrollment
deno task dev      # watch, puerto 8882
deno task start    # sin watch
```

`deno check server.ts` debe ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-enrollment
docker compose -p shalom_backend --env-file .env logs -f service-enrollment
```

Contenedor `shalom_service_enrollment`, puerto 8882, bind mount en `/app` con `deno task dev` (hot reload).
