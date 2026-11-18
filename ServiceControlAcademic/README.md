# ServiceControlAcademico

Servicio de control académico y asistencia (Deno + Oak, puerto 8888).

## Descripción

- **Qué hace:** gestiona asistencia con validación horaria, calificaciones por malla curricular, temas y avance, exámenes parciales, reportes de riesgo/asistencia/calificaciones.
- **Público objetivo:** docentes (pase de lista, calificaciones), director/control (reportes, gestión).
- **Comunicación:** REST + Webhooks (entrada) + WebSockets (tiempo real, salida).
- **Integración:** recibe eventos de `ServiceAcademicLLMs` (`content.processed`), `ServiceHomework` (`materiales.create`), `ServiceAcademic` (`calificaciones.create`, `horarios.generados`, `malla.actualizada`), `ServiceEnrollment` (`inscripciones.create`).

## Base de Datos

Tablas principales (requieren migración en PostgreSQL):

- `asistencia` (estudiante_id, asignacion_id, materia_id, tema_id, fecha, estado, justificacion, hora_registro, validado_por_horario)
- `calificaciones_control` (estudiante_id, asignacion_id, materia_id, tema_id, tipo_evaluacion, trimestre, nota, observacion, peso, fecha_evaluacion)
- `malla_temas` (existente en ServiceAcademic, se reusa)
- `examenes_parciales` (materia_id, asignacion_id, curso_periodo_id, trimestre, titulo, descripcion, fecha_examen, hora_inicio, hora_fin, peso_total, estado)
- `preguntas_examen` (examen_id, enunciado, tipo, opciones, respuesta_correcta, puntaje, orden, tema_id)
- `respuestas_examen` (examen_id, estudiante_id, pregunta_id, respuesta, correcta, puntaje_obtenido, tiempo_respuesta_ms)

## Configuración (`.env`)

```env
# Puerto
PORT=8888

# PostgreSQL
DB_HOST=host.docker.internal
DB_PORT=5432
DB_USER=ShalomAccess
DB_NAME=ShalomDB
DB_PASS=ShAloM4
DB_POOL=10

# Redis (notificaciones + PubSub)
REDIS_URL=host.docker.internal
REDIS_PORT=6379
REDIS_USER=cache_user
REDIS_PASSWORD=UserCachePass123
REDIS_DB=0
EVENTOS_CANAL=notificaciones:eventos

# JWT
JWT_SECRET=nosexd

# Gateway
GATEWAY_PUBLIC_URL=http://localhost:5141
INTERNAL_PUSH_TOKEN=shalom-internal-push
```

## Docker

```bash
docker compose -p shalom_backend --env-file .env build service-control-academico
docker compose -p shalom_backend --env-file .env up -d service-control-academico
```

Hot reload: el directorio se monta como volume en `docker-compose.yml`.

## Endpoints (REST)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/webhook` | - | Webhooks entrada |
| GET | `/asistencia` | control | Listar asistencia (filtros: asignacionId, estudianteId, materiaId, cursoPeriodoId, fechaDesde, fechaHasta, estado) |
| GET | `/asistencia/:id` | control | Obtener asistencia por ID |
| POST | `/asistencia` | docente | Registrar asistencia individual |
| POST | `/asistencia/bulk` | docente | Registrar asistencia masiva (pase de lista) |
| PUT | `/asistencia/:id` | docente | Actualizar asistencia |
| DELETE | `/asistencia/:id` | docente | Eliminar asistencia |
| GET | `/asistencia/reporte/curso?cursoPeriodoId=X&materiaId=Y` | control | Reporte asistencia por curso |
| GET | `/asistencia/estudiante?estudianteId=X&materiaId=Y` | control | Asistencia de un estudiante |
| GET | `/calificaciones` | control | Listar calificaciones |
| POST | `/calificaciones` | docente | Crear calificación |
| POST | `/calificaciones/bulk` | docente | Calificaciones masivas |
| GET | `/calificaciones/reporte/materia?materiaId=X&cursoPeriodoId=Y&trimestre=Z` | control | Reporte calificaciones por materia |
| GET | `/temas` | control | Listar temas (filtros: materiaId, unidad, activo) |
| POST | `/temas` | docente | Crear tema |
| GET | `/temas/progreso/estudiante?estudianteId=X&materiaId=Y` | control | Progreso estudiante por temas |
| GET | `/examenes` | control | Listar exámenes |
| POST | `/examenes` | docente | Crear examen parcial |
| POST | `/examenes/responder` | control | Responder examen (estudiante) |
| GET | `/examenes/:id/resultados` | control | Resultados examen |
| GET | `/reportes/asistencia?cursoPeriodoId=X&materiaId=Y` | control | Reporte asistencia |
| GET | `/reportes/calificaciones?materiaId=X&cursoPeriodoId=Y&trimestre=Z` | control | Reporte calificaciones |
| GET | `/reportes/riesgo?estudianteId=X&cursoPeriodoId=Y` | control | Reporte riesgo estudiante |
| GET | `/reportes/ranking/materia?materiaId=X&cursoPeriodoId=Y&trimestre=Z` | control | Ranking materia |
| GET | `/health` | - | Health check |

### Payload: Asistencia Bulk (Pase de Lista)

```json
POST /asistencia/bulk
{
  "asignacionId": "123",
  "materiaId": "456",
  "fecha": "2026-10-12",
  "asistencias": [
    { "estudianteId": "789", "estado": "presente", "temaId": "10", "horaRegistro": "08:05" },
    { "estudianteId": "790", "estado": "ausente", "justificacion": "Enfermedad" },
    { "estudianteId": "791", "estado": "atraso", "horaRegistro": "08:20" }
  ]
}
```

### Payload: Crear Examen Parcial

```json
POST /examenes
{
  "materiaId": "456",
  "asignacionId": "123",
  "cursoPeriodoId": "789",
  "trimestre": 1,
  "titulo": "Examen Parcial 1 - Matemáticas",
  "descripcion": "Evaluación de unidades 1-3",
  "fechaExamen": "2026-10-20",
  "horaInicio": "08:00",
  "horaFin": "09:30",
  "preguntas": [
    {
      "enunciado": "Resuelve la ecuación: 2x + 5 = 15",
      "tipo": "desarrollo",
      "respuestaCorrecta": "x = 5",
      "puntaje": 20,
      "orden": 1,
      "temaId": "10"
    },
    {
      "enunciado": "¿Cuál es la derivada de x²?",
      "tipo": "opcion_multiple",
      "opciones": ["2x", "x", "2", "x²"],
      "respuestaCorrecta": "2x",
      "puntaje": 15,
      "orden": 2,
      "temaId": "11"
    }
  ]
}
```

## Webhooks (Entrada)

| Evento | Origen | Acción |
|--------|--------|--------|
| `content.processed` | ServiceAcademicLLMs | Notificar nuevo contenido para repasar |
| `materiales.create` | ServiceHomework | Nuevo material disponible |
| `calificaciones.create` | ServiceAcademic | Evaluar puntos por rendimiento |
| `inscripciones.create` | ServiceEnrollment | Inicializar datos estudiante |
| `horarios.generados` | ServiceAcademic | Horarios disponibles para validación asistencia |
| `malla.actualizada` | ServiceAcademic | Malla curricular actualizada |

## WebSockets (Tiempo Real)

Conexión: `ws://localhost:8888/ws?token=<JWT>`

### Eventos Servidor → Cliente

| Evento | Canal | Payload |
|--------|-------|---------|
| `control:asistencia_registrada` | `control:personal:{usuarioId}` | `{usuarioId, asistenciaId, estado, timestamp}` |
| `control:calificacion_registrada` | `control:personal:{usuarioId}` | `{usuarioId, calificacionId, nota, timestamp}` |
| `control:tema_completado` | `control:personal:{usuarioId}` | `{usuarioId, temaId, progreso, timestamp}` |
| `control:examen_registrado` | `control:personal:{usuarioId}` + global | `{examenId, titulo, fechaExamen, timestamp}` |
| `control:alerta_riesgo` | `control:personal:{usuarioId}` | `{usuarioId, nivelRiesgo, mensaje, timestamp}` |
| `control:reporte_generado` | `control:personal:{usuarioId}` | `{tipo, url, timestamp}` |
| `control:recompensa_global` | `control:curso:{cursoPeriodoId}:{paralelo}` | `{cursoPeriodoId, paralelo, recompensa, timestamp}` |

## Verificación

```bash
deno task check  # deno check server.ts
# o
deno check server.ts
```

## Logs

```bash
docker compose -p shalom_backend logs -f service-control-academico
```