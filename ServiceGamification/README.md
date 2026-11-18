# ServiceGamification

Servicio de gamificación para estudiantes (Deno + Oak, puerto 8887).

## Descripción

- **Qué hace:** gestiona rachas diarias, puntos individuales/globales, insignias, trofeos, tienda de recompensas, ranking por paralelos y actividades gamificadas.
- **Público objetivo:** **solo estudiantes** (rol `estudiante`). Otros roles reciben 403.
- **Comunicación:** REST + Webhooks (entrada) + WebSockets (tiempo real, salida).
- **Integración:** recibe eventos de `ServiceAcademicLLMs` (`content.processed`), `ServiceHomework` (`materiales.create`), `ServiceAcademic` (`calificaciones.create`), `ServiceEnrollment` (`inscripciones.create`).

## Base de Datos

Esquema independiente en PostgreSQL (`ShalomDBGM`, archivo `Esquems/BDgm.sql`). Tablas principales:

- `estudiantes_gamificacion` (usuario_id, estudiante_id, curso_periodo_id, paralelo, nombre, apellido_paterno, avatar_url, estado)
- `rachas_diarias` (usuario_id, fecha, completada, aciertos, total_preguntas, porcentaje_acierto, racha_actual, mejor_racha, salvada_con_puntos, puntos_gastados)
- `puntos_individuales` (usuario_id, fecha, tipo, puntos, descripcion, metadata)
- `puntos_globales` (curso_periodo_id, paralelo, fecha, puntos_ganados, descripcion)
- `insignias` (codigo, nombre, descripcion, criterio, activa)
- `insignias_estudiante` (usuario_id, insignia_id, fecha_obtencion, metadata)
- `trofeos` (codigo, nombre, descripcion, puntos, criterio, periodo, activo)
- `trofeos_estudiante` (usuario_id, trofeo_id, fecha_obtencion, puntos_otorgados, metadata)
- `tienda_recompensas` (nombre, descripcion, costo_puntos_individuales, tipo, icono_url, stock, activa)
- `compras_estudiante` (usuario_id, recompensa_id, puntos_gastados, fecha_compra, usada, fecha_uso)
- `actividades_gamificadas` (usuario_id, estudiante_id, tipo, materia_id, materia_nombre, titulo, preguntas, respuestas, aciertos, total, porcentaje_acierto, tiempo_total_ms, puntos_ganados, puntos_calidad, puntos_tiempo, completada, fecha_inicio, fecha_fin)

## Configuración (`.env`)

```env
# Puerto
PORT=8887

# PostgreSQL
DB_HOST=host.docker.internal
DB_PORT=5432
DB_USER=ShalomAccess
DB_NAME=ShalomDBGM
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
docker compose -p shalom_backend --env-file .env build service-gamification
docker compose -p shalom_backend --env-file .env up -d service-gamification
```

Hot reload: el directorio se monta como volume en `docker-compose.yml`.

## Endpoints (REST)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/webhook` | - | Webhooks desde gateway/otros servicios |
| GET | `/gamificacion/resumen` | `estudiante` | Resumen: racha, puntos, insignias, trofeos |
| GET | `/gamificacion/info-estudiante` | `estudiante` | Info curso/paralelo del estudiante |
| POST | `/gamificacion/actividad` | `estudiante` | Registrar actividad completada |
| POST | `/gamificacion/racha/salvar` | `estudiante` | Salvar racha (100 pts) |
| POST | `/gamificacion/pista` | `estudiante` | Usar pista examen (95 pts) |
| GET | `/gamificacion/tienda` | `estudiante` | Listar recompensas disponibles |
| POST | `/gamificacion/tienda/canjear` | `estudiante` | Canjear recompensa (body: recompensaId) |
| GET | `/gamificacion/ranking?cursoPeriodoId=X` | `estudiante` | Ranking paralelos A/B |
| GET | `/gamificacion/info` | `estudiante` | Info gamificación del estudiante |
| GET | `/health` | - | Health check |

### Payload: Completar Actividad

```json
POST /gamificacion/actividad
{
  "estudianteId": "123",
  "cursoPeriodoId": "456",
  "paralelo": "A",
  "materiaId": "789",
  "materiaNombre": "Matemáticas",
  "tipo": "drag_drop",
  "titulo": "Ecuaciones cuadráticas",
  "preguntas": [
    {
      "id": "q1",
      "texto": "Ordena los pasos para resolver...",
      "tipo": "drag_drop",
      "respuestaCorrecta": ["paso1", "paso2", "paso3"],
      "puntosBase": 10,
      "tiempoLimiteMs": 120000,
      "orden": 1
    }
  ],
  "respuestas": [
    {
      "preguntaId": "q1",
      "respuesta": ["paso1", "paso2", "paso3"],
      "correcta": true,
      "tiempoMs": 45000
    }
  ],
  "tiempoTotalMs": 45000,
  "fechaInicio": "2026-10-12T10:00:00Z",
  "fechaFin": "2026-10-12T10:00:45Z"
}
```

### Respuesta: Completar Actividad

```json
{
  "actividad": { "id": "...", "puntosGanados": 25, "completada": true, ... },
  "racha": { "rachaActual": 5, "mejorRacha": 7, "completada": true, ... },
  "puntosGanados": 25,
  "insigniasNuevas": [{ "insigniaId": "speedrun", "nombre": "Speedrun", ... }],
  "trofeosNuevos": []
}
```

## Webhooks (Entrada)

| Evento | Origen | Descripción |
|--------|--------|-------------|
| `content.processed` | ServiceAcademicLLMs | Material procesado, notificar nuevo contenido |
| `materiales.create` | ServiceHomework | Nuevo material subido |
| `calificaciones.create` | ServiceAcademic | Nueva calificación |
| `inscripciones.create` | ServiceEnrollment | Nueva inscripción estudiante |
| `notificaciones.leer` | ServiceNotification | Notificación leída |

## WebSockets (Tiempo Real)

Conexión: `ws://localhost:8887/ws?token=<JWT>`

### Eventos Servidor → Cliente

| Evento | Canal | Payload |
|--------|-------|---------|
| `gamificacion:puntos_actualizados` | `gamificacion:personal:{usuarioId}` | `{ usuarioId, puntos, tipo, timestamp }` |
| `gamificacion:racha_actualizada` | `gamificacion:personal:{usuarioId}` | `{ usuarioId, rachaActual, mejorRacha, timestamp }` |
| `gamificacion:insignia_ganada` | `gamificacion:personal:{usuarioId}` | `{ usuarioId, insigniaId, nombre, timestamp }` |
| `gamificacion:trofeo_ganado` | `gamificacion:personal:{usuarioId}` + global | `{ usuarioId, trofeoId, nombre, puntos, timestamp }` |
| `gamificacion:alerta_ranking` | `gamificacion:personal:{usuarioId}` | `{ usuarioId, mensaje, posicionActual, posicionAmenaza, timestamp }` |
| `gamificacion:recompensa_global` | `gamificacion:paralelo:{cursoPeriodoId}:{paralelo}` | `{ cursoPeriodoId, paralelo, recompensa, descripcion, timestamp }` |

## Reglas de Gamificación

- **Racha diaria:** 90% aciertos mínimo. Costo salvar: 100 pts.
- **Puntos individuales:** +5 respuesta correcta (calidad + tiempo), +4 leer resumen.
- **Pistas examen:** 95 pts.
- **Puntos globales:** 3-5 por día al completar racha.
- **Meta diaria:** 3-10 temas (adaptativo por ServiceAcademicLLMs).
- **Insignias automáticas:** Speedrun, Nuevo Aprendizaje, Repaso Masivo, Reincorporación, Mejor Semana, Alto Rendimiento, Dominio Total.
- **Trofeos:** Mejor Semana (500 pts), Alto Rendimiento (2000 pts), Dominio Total (5000 pts).
- **Actividades:** selección múltiple, cuestionario, flashcards, V/F, conectar frases, drag & drop.

## Verificación

```bash
deno check server.ts
# o
deno task check
```

## Logs

```bash
docker compose -p shalom_backend logs -f service-gamification
```