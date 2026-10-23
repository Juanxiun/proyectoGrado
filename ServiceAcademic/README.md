# ServiceAcademic

![Deno](https://img.shields.io/badge/Deno-2.9-121212?logo=deno&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Oak](https://img.shields.io/badge/Oak-17-000000)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** núcleo académico del sistema. Gestiona periodos (CRUD, clonado, generación de estructura/cursos/horarios/planes de pago, activar/desactivar), trimestres, mallas curriculares y temas, materias, grados y materias por grado, cursos, aulas, horarios (algoritmo automático + manual) y seguimiento de riesgo académico (libro, panel por curso/estudiante, umbrales). Publica eventos en Redis y expone rutas internas con token propio para que `ServiceDashboard`/`ServiceNotification` consulten seguimiento. Aquí viven los únicos tests Deno del backend (`deno task test`, 18 tests).
- **Puerto:** 8881.
- **Tablas que usa** (`Esquems/BDmain.sql`): `usuarios`, `estudiantes`, `maestros`, `maestro_materias`, `periodos_academicos`, `trimestres`, `turnos`, `aulas`, `materias`, `cursos`, `grado_materias`, `malla_temas`, `cursos_periodo`, `mallas_curriculares`, `asignaciones_docentes`, `horarios`, `curso_asesor`, `solicitudes_inscripcion`, `inscripciones`, `materia_materiales`, `encargos`, `encargo_materiales`, `encargo_entregas`, `calificaciones`, `asistencia`, `planes_pago`, `cuotas_plan_pago`, `pensiones`, `pagos`, `pago_pensiones`.

## Roles permitidos

| Guard | Roles | Rutas que cubre |
| --- | --- | --- |
| `ROLES_LECTURA` | director, control, profesor, estudiante | GET de periodos, trimestres, horarios, mallas, materias, cursos, grados, aulas, planes-pago, seguimiento |
| `ROLES_GESTION` | director, control | CREAR/ACTUALIZAR/ELIMINAR periodos, estructura, horarios, planes, materias, mallas; `GET /seguimiento/riesgo` |
| `ROLES_DOCENTES` | director, control, profesor | `PUT /malla/materia`, `POST/PUT/DELETE /malla/tema*` |
| `requireInternalToken()` | servicios internos | `GET /seguimiento/internal/*` |
| Público | — | `POST /webhook` (gateway), `GET /health` |

## Rutas

| Método | Ruta | Guard |
| --- | --- | --- |
| POST | `/webhook` | interno (gateway) |
| POST | `/periodos/:id/clonar` · `:id/clone` | gestión |
| POST | `/periodos/:id/generar-estructura` · `:id/estructura/generar` · `:id/generar-cursos` | gestión |
| POST | `/periodos/:id/generar-horarios` · `:id/horarios/generar` | gestión |
| POST | `/periodos/:id/horarios/manual` | gestión |
| POST | `/periodos/:id/generar-plan-pagos` · `:id/plan-pagos/generar` | gestión |
| POST | `/periodos/:id/activar` · `:id/desactivar` | gestión |
| GET | `/periodos/:id/estado` · `:id/readiness` | lectura |
| GET | `/periodos/:id/validacion` · `:id/validar` | lectura |
| GET | `/periodos/:id/trimestres` | lectura |
| GET / POST / PUT / DELETE | `/periodos` y `/periodos/:id` | lectura (GET) / gestión (escritura) |
| GET | `/trimestres` | lectura |
| GET | `/horarios` | lectura |
| POST | `/horarios/generar` · `/horarios/manual` | gestión |
| GET / POST | `/mallas-curriculares` | lectura (GET) / gestión (POST) |
| GET | `/planes-pago` | lectura |
| POST | `/planes-pago/generar` | gestión |
| GET / POST | `/aulas` | lectura (GET) / gestión (POST) |
| GET / POST / PUT / DELETE | `/cursos` y `/cursos/:id` | lectura (GET) / gestión (escritura) |
| GET | `/grados`, `/grados/materias` | lectura |
| POST / PUT / DELETE | `/grados/materias`, `/grados/materias/:materiaId` | gestión |
| GET | `/malla`, `/malla/resumen`, `/malla/materia` | lectura |
| PUT | `/malla/materia` | docentes |
| POST | `/malla/tema` | docentes |
| PUT / DELETE | `/malla/tema/:id` | docentes |
| GET / POST / PUT / DELETE | `/materias` y `/materias/:id` | lectura (GET) / gestión (escritura) |
| GET | `/seguimiento/libro`, `/seguimiento/panel/curso`, `/seguimiento/panel/estudiante/:id` | lectura |
| GET | `/seguimiento/riesgo` | gestión |
| GET | `/seguimiento/umbrales` | lectura |
| GET | `/seguimiento/internal/estudiante/:id`, `/seguimiento/internal/umbrales` | token interno |
| GET | `/health` | público |

## Inicialización por consola

Requisitos: Postgres `127.0.0.1:5432`, Redis `6379` (stack externo al repo), esquema de `Esquems/BDmain.sql` y `.env` local (gitignored) con `JWT_SECRET` compartido.

```powershell
cd ServiceAcademic
deno task dev      # watch, puerto 8881
deno task start    # sin watch
deno task test     # utils/*_test.ts -> 18 tests
```

`deno check server.ts` y `deno task test` deben ejecutarse con esta carpeta como directorio de trabajo.

## Inicialización por Docker

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env up -d service-academic
docker compose -p shalom_backend --env-file .env logs -f service-academic
```

Contenedor `shalom_service_academic`, puerto 8881, bind mount en `/app` con `deno task dev` (hot reload).
