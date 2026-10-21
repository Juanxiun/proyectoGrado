# ServiceAcademicLLMs (serviceLLMs)

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![LM Studio](https://img.shields.io/badge/LM%20Studio-modelos%20locales-00A3E0)
![Redis Stack](https://img.shields.io/badge/Redis%20Stack-vectorial-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## Descripción

- **Qué hace:** servicio Python asíncrono (puerto 8890) para procesar materiales académicos cargados en `ServiceHomework`: conserva el chunking semántico adaptativo para detectar estructura y ejercicios, selecciona fragmentos representativos para guiar a Mistral sin exigir recuperación exhaustiva, e indexa solo referencias seleccionadas y contenido validado en Redis Stack. Gemma evalúa la calidad. Genera guías, resúmenes avanzados y actividades gamificadas con conocimiento académico general compatible con el material. Calcula perfiles de aprendizaje por alumno. Conserva los IDs académicos que ya entrega el backend.
- **Tablas que usa:** ninguna en SQL — persiste todo en Redis (`shalom:rag:*`, streams de trabajos e intentos por alumno/contenido). No debe agregarse una base paralela.
- **Nota de nombre:** la carpeta real es `ServiceAcademicLLMs/`; este README históricamente se tituló `serviceLLMs`.

## Roles permitidos

No usa JWT ni roles: la única autenticación es el header `X-Webhook-Secret` (compartido con `ServiceHomework` vía `LLM_WEBHOOK_SECRET`) y **no debe exponerse al navegador**.

| Acceso | Rutas |
| --- | --- |
| Público (sin secreto) | `GET /health`, `GET /ready` |
| Secreto interno `X-Webhook-Secret` | el resto: `/rag/*`, `/jobs/*`, `/webhooks/*`, `/students/*` |
| Sin proxy todavía | no existe contrato ni ruta en RestApi/Frontend; el gateway debe validar JWT/rol y reenviar con el secreto solo en servidor |

## Rutas

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/health` | público |
| GET | `/ready` | público (503 si faltan Redis Stack/LM Studio/modelos) |
| GET | `/rag/structure` | `X-Webhook-Secret` |
| GET | `/rag/search?q=&content_id=&subject_id=&limit=` | `X-Webhook-Secret` |
| POST | `/webhooks/content-created` | `X-Webhook-Secret` (202 + idempotencia) |
| POST | `/webhooks/quiz-completed` | `X-Webhook-Secret` |
| GET | `/jobs/{job_id}` | `X-Webhook-Secret` |
| POST | `/students/{student_id}/contents/{content_id}/quizzes` | `X-Webhook-Secret` |
| POST | `/contents/{content_id}/summaries` | `X-Webhook-Secret` |
| GET | `/students/{student_id}/profiles/{content_id}` | `X-Webhook-Secret` |
| POST | `/students/{student_id}/contents/{content_id}/personalized` | `X-Webhook-Secret` |

Semántica de payloads y respuestas en "Contrato y endpoints" más abajo.

## Inicialización por consola

Requisitos: Python 3.12 con el entorno virtual propio, Redis Stack (Search/vectorial) y LM Studio con los modelos instalados. Variables obligatorias: `LMSTUDIO_BASE_URL=http://127.0.0.1:1234`, `REDIS_HOST=127.0.0.1`, `LMSTUDIO_EMBEDDING_MODEL` (tag con soporte `/v1/embeddings`) y `WEBHOOK_SECRET`/`LLM_WEBHOOK_SECRET` no vacío.

```powershell
cd ServiceAcademicLLMs
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8890
.\venv\Scripts\python.exe -m unittest discover -s tests -v   # tests rapidos con fakes
```

Detalle de variables en la sección "Configuración".

## Inicialización por Docker

Desde la raíz del repositorio (requiere `LLM_WEBHOOK_SECRET` en el `.env` de la raíz; sin Redis Stack en host:6380 y LM Studio en host:1234, `/ready` queda en 503):

```powershell
docker compose -p shalom_backend --env-file .env build service-llms
docker compose -p shalom_backend --env-file .env up -d service-llms
docker compose -p shalom_backend --env-file .env logs -f service-llms
```

Contenedor `shalom_service_llms`, publica `127.0.0.1:8890` y **no tiene hot reload** (sin volume): tras cambiar código hay que reconstruir la imagen.

## Flujo disponible

1. `ServiceHomework` guarda el material y responde al profesor sin esperar al servicio LLM.
2. En segundo plano envía `content.created` a `POST /webhooks/content-created`. El webhook valida `X-Webhook-Secret`, registra un trabajo idempotente en un Redis Stream y devuelve `202`.
3. Un worker descarga el archivo desde MinIO, extrae texto de PDF, DOCX, XLSX, XLS o CSV y lo divide en fragmentos por tema. Conserva títulos, filtra ruido y selecciona evidencia distribuida del propio material.
4. Gemma genera la síntesis educativa desde los fragmentos fuente y, en una solicitud posterior, crea 20 actividades basadas en esos mismos fragmentos. Las actividades deben referenciar fragmentos existentes, ser distintas y dividirse en 10 teóricas y 10 prácticas. El servicio rechaza salidas incompletas o sin referencias válidas.
5. Redis Stack indexa el texto de los fragmentos originales y la síntesis con metadatos de material, materia, tema y grado. El contenido validado y el banco de actividades se conservan además como datos estructurados `shalom:rag:*`. No se indexan prompts ni marcos pedagógicos generales como conocimiento académico.
6. Un servicio de prueba emite 5 o 6 actividades variadas y sin claves de respuesta para cada alumno y contenido. Las respuestas se guardan solo como resultados de aprendizaje en Redis; la corrección devuelve de inmediato el concepto fallado, la respuesta esperada y una explicación contextual. Se ignoran actividades ya usadas y Mistral genera nuevas cuando el banco se agota.
7. Cada intento agrega un hito sin la respuesta libre del alumno a la rama `students`. Al completar cuatro pruebas diferentes, un worker calcula el perfil de aprendizaje y lo guarda bajo el par alumno/contenido; posteriormente actualiza el vector del perfil. El nivel y los formatos recomendados usan tendencias observadas y los umbrales configurados.
8. La generación personalizada combina guía docente aprobada, referencias RAG seleccionadas y perfil del alumno; el documento orienta el tema y los detalles del curso sin limitar cada explicación a coincidencias literales. El resultado se almacena por alumno/contenido y versión del perfil.
9. `POST /contents/{content_id}/summaries` devuelve esquema `ESQUEMA_GEMMA` (nodos y aristas) con calidad garantizada por Gemma. Se almacena en caché por contenido y versión.

Al arrancar, `serviceLLMs` crea la estructura educativa del RAG y elimina los vectores y claves heredados de la rama `methodology`. Un chequeo en segundo plano valida los modelos configurados y los embeddings; si Redis/LM Studio no están disponibles, se reintenta y `/ready` permanece en 503. El RAG se centra en fragmentos de materiales fuente, síntesis, actividades y progreso aislado por estudiante y contenido.

## Contrato y endpoints

- `GET /health`: proceso vivo.
- `GET /ready`: Redis Stack/Search, esquema base creado, tags instalados y autoprueba real de inferencia Gemma, Mistral y embeddings.
- `GET /rag/structure`: árbol descriptivo de las ramas del RAG y conteo de mini-contextos (requiere `X-Webhook-Secret`).
- `POST /webhooks/content-created`: webhook autenticado, respuesta rápida `202` e idempotencia por `content_id`.
- `GET /jobs/{job_id}`: estado y progreso del pipeline.
- `GET /rag/search?q=...&content_id=...&subject_id=...`: recuperación vectorial acotada.
- `POST /students/{student_id}/contents/{content_id}/quizzes`: emitir prueba (5 o 6 actividades variadas), autenticada con `X-Webhook-Secret`; el cuerpo debe repetir `student_id`, `content_id` y opcionalmente `activity_count`. La respuesta incluye `activities` sin respuestas: `SELECCION_MULTIPLE` (enunciado y 4 opciones), `CUESTIONARIO` (pregunta corta), `FLASHCARD` (anverso y reverso para autoevaluación), `VERDADERO_FALSO` (afirmación), `CONECTAR_FRASES` (pares) y `DRAG_AND_DROP` (elementos en orden mezclado; solo matemáticas, química y física).
- `POST /webhooks/quiz-completed`: registrar respuestas; `attempt_id` debe ser el `quiz_id` recibido al emitir la prueba. Cada respuesta lleva `activity_id` y `response`. La corrección depende del tipo: opción exacta en selección múltiple, palabras clave en cuestionario, autoevaluación en flashcard, booleano en verdadero/falso, pares `lado A => lado B` en conectar frases y secuencia separada por `;` en drag and drop.
- `POST /contents/{content_id}/summaries`: resumen avanzado del contenido validado (formato `ESQUEMA_GEMMA`); el cuerpo acepta `formato` con `auto` o `ESQUEMA_GEMMA`. Devuelve `nodes` y `edges` listos para renderizar en el frontend.
- `GET /documents/{document_id}/learning`: contenido validado del material, autenticado con `X-Webhook-Secret`.
- `GET /students/{student_id}/profiles/{content_id}`: perfil después de completar cuatro pruebas.
- `POST /students/{student_id}/contents/{content_id}/personalized`: generar o recuperar explicación personalizada una vez creado el perfil.

Las rutas de alumnos/cuestionarios y los webhooks están protegidos con el secreto interno. El móvil usa `/api/aprendizaje/materiales/{id}` en el gateway; ServiceHomework valida el JWT de estudiante y reenvía las llamadas con el secreto guardado solo en el servidor. El repositorio no cuenta actualmente con entidades persistentes para cuestionarios o respuestas; el nuevo flujo conserva sus intentos en Redis por alumno y contenido, sin crear tablas ficticias.

El evento contiene los campos disponibles al crear un material: ID del material, asignación, materia, nivel/grado/paralelo, título, archivo y URL interna de MinIO. La entidad actual no expone un `topic_id`; no se inventa.

## Configuración

`docker-compose.yml` consume estas variables desde `.env`:

| Variable | Uso |
| --- | --- |
| `LMSTUDIO_BASE_URL` | URL accesible desde los contenedores (por defecto `http://host.docker.internal:1234`). LM Studio debe estar abierto y aceptar conexiones desde Docker. |
| `LMSTUDIO_EMBEDDING_URL` | URL del servidor OpenAI compatible con `/v1/embeddings`; por defecto usa `LMSTUDIO_BASE_URL`. |
| `LMSTUDIO_GEMMA_MODEL`, `LMSTUDIO_MISTRAL_MODEL` | Tags exactos presentes en LM Studio. No se descargan modelos automáticamente. |
| `LMSTUDIO_EMBEDDING_MODEL` | Tag ya instalado que soporte `/v1/embeddings`; necesario para RAG vectorial. |
| `REDIS_RAG_HOST`, `REDIS_RAG_PORT`, `REDIS_RAG_USERNAME`, `REDIS_RAG_PASSWORD` | Redis Stack. Como vive en un compose separado, se usa el puerto publicado del host (`host.docker.internal:6380`), no el DNS `redis_rag` que no comparte red. |
| `LLM_WEBHOOK_SECRET` | Secreto compartido entre `ServiceHomework` y este servicio. Configure un valor aleatorio antes de levantar Docker. |
| `LLM_CHUNK_SIZE`, `LLM_CHUNK_MIN_CHARS`, `LLM_CHUNK_SEMANTIC_THRESHOLD`, `LLM_MAX_CHUNKS_PER_DOCUMENT` | Límites del chunking semántico: tamaño máximo por fragmento, tamaño mínimo antes de fusionar y umbral de cohesión léxica para detectar cambios de tema. |
| `LLM_ACCEPTANCE_THRESHOLD`, `LLM_MAX_REFINEMENT_ITERATIONS` | Umbral de rúbrica (no probabilidad científica) e iteraciones. |
| `LLM_REQUEST_TIMEOUT`, `LLM_MAX_CONCURRENCY`, `LLM_WORKER_COUNT`, `LLM_JOB_MAX_RETRIES` | Límites de ejecución y recuperación. |

La infraestructura existente no declara LM Studio ni un modelo de embeddings instalado. Antes de habilitar procesamiento, instala manualmente los modelos elegidos en el host y configura sus tags y `REDIS_RAG_PASSWORD`. La URL/credencial Redis actual del compose externo debe coincidir con esos valores.

El contexto y la descarga de capas a GPU se configuran en LM Studio en el host; las variables Docker del servicio no cambian esos valores. Para usar más GPU, revisa la memoria disponible y el consumo por modelo en LM Studio y carga el modelo con su opción GPU `max` si cabe; si no, deja una parte en CPU para evitar errores de memoria. No busques 100% de uso constante: la generación token a token, la memoria disponible y el tiempo de evaluación del prompt también limitan la utilización. La documentación de LM Studio describe el ajuste GPU y el contexto durante la carga del modelo.

Para usar LM Studio en Windows, comprueba que responde en `http://localhost:1234/api/v1/models` desde el host; dentro del contenedor se accede mediante `http://host.docker.internal:1234`. LM Studio debe escuchar en la interfaz de red del host (Settings → Network → "Listen on all interfaces") y el firewall debe permitir el puerto 1234 desde Docker. Después de cambiar la configuración de red, reinicia LM Studio. Si no escucha en la interfaz del host, `/ready` permanece en 503 aunque el contenedor esté activo. No se descargan modelos desde el servicio. Los prompts de `prompts/` se cargan al inicio y las guías versionadas modifican su embedding únicamente cuando cambia su texto.

La configuración Docker anterior aplica solo cuando `serviceLLMs` corre dentro de Docker. Si tanto `serviceLLMs` como LM Studio se ejecutan directamente en Windows, usa `LMSTUDIO_BASE_URL=http://127.0.0.1:1234` y `REDIS_HOST=127.0.0.1` (Redis Stack debe publicar su puerto RAG, por defecto 6380). Para arrancar el servicio localmente desde esta carpeta:

```powershell
$env:LMSTUDIO_BASE_URL = "http://127.0.0.1:1234"
$env:REDIS_HOST = "127.0.0.1"
$env:LMSTUDIO_EMBEDDING_MODEL = "text-embedding-nomic-embed-text-v1.5"
$env:WEBHOOK_SECRET = "<el mismo secreto que usará la prueba>"
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8890
```

Redis debe ser **Redis Stack con Search/Vector**, no una instancia Redis básica. `/ready` comprueba el comando `FT._LIST` e incluye `redis_vector_search`; si es `false`, no se puede indexar el RAG aunque `redis` aparezca como `true`.

## Ejecutar

Desde la raíz del repositorio:

```powershell
docker compose -p shalom_backend --env-file .env build service-llms
docker compose -p shalom_backend --env-file .env up -d service-llms
```

Pruebas rápidas y simuladas (desde `ServiceAcademicLLMs/`, con el entorno virtual del servicio):

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

La prueba `test_full_flow.py` simula Redis y LM Studio para validar rápidamente las transiciones. `test_live_integration.py` es una prueba aparte que no usa esos dobles: llama al endpoint real, comprueba LM Studio y Redis Stack, ejecuta el pipeline chunking semántico → análisis Mistral → refinamiento → evaluación → embeddings/Redis Vector Search, crea cuatro pruebas por HTTP, espera el perfil y solicita contenido personalizado. También comprueba que el material guardado registra los tags reales de los modelos, la valoración aprobada y el banco de actividades. Usa IDs aleatorios y elimina las claves y vectores creados al finalizar.

Para ejecutar la integración real:

1. Levanta Redis Stack con el módulo de búsqueda vectorial y LM Studio con `google/gemma-4-e4b`, `mistralai/mistral-7b-instruct-v0.3` y `text-embedding-nomic-embed-text-v1.5` ya instalados. Si ejecutas `serviceLLMs` localmente en Windows, arráncalo con Uvicorn según la sección anterior; si corre en Docker, inicia el contenedor y usa sus direcciones Docker. Configura `LMSTUDIO_EMBEDDING_MODEL` con el tag compatible con `/v1/embeddings`. Comprueba `http://localhost:8890/ready` y configura un secreto interno no vacío.
2. Configura `LMSTUDIO_EMBEDDING_MODEL` con el mismo tag de embeddings que usa el servicio Python. En PowerShell, desde `ServiceAcademicLLMs/`, establece `LMSTUDIO_EMBEDDING_MODEL`, `LLM_INTEGRATION=1`, `LLM_INTEGRATION_BASE_URL=http://127.0.0.1:8890` y `LLM_INTEGRATION_WEBHOOK_SECRET` con el mismo secreto interno del servicio. El proceso Python de pruebas no carga automáticamente el `.env` de la raíz; exportar la variable evita que la prueba use un modelo distinto al servicio. `LLM_INTEGRATION_DOCUMENT_HOST` ahora usa `127.0.0.1` por defecto porque el servicio se ejecuta localmente. Si el servicio Python corre en Docker, establece esa variable como `host.docker.internal`.
3. Ejecuta solo la prueba real para distinguirla de las validaciones rápidas:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s tests -p test_live_integration.py -v
```

La prueba tarda lo que requieran los modelos y tiene un máximo predeterminado de 20 minutos. Se puede cambiar con `LLM_INTEGRATION_TIMEOUT_SECONDS` y ajustar la consulta periódica con `LLM_INTEGRATION_POLL_SECONDS`. **No descarga modelos**: si falta uno o `/ready` responde 503, la prueba informa qué dependencia no está operativa. Para permitir que Docker descargue el fixture servido por la prueba, Windows debe aceptar la conexión al puerto temporal elegido por el servidor de prueba.

## Límites de integración actuales

- El flujo interno de cuestionarios/perfiles ya existe en `serviceLLMs`, pero debe integrarse al gateway antes de ser invocado por el frontend. No existe todavía un contrato/pantalla de cuestionarios en el frontend ni entidades de intentos en la API; no se agrega una base paralela SQL.
- El perfil es pedagógico a partir de los resultados de las pruebas recibidas. La integración con notas se deja pendiente porque no se ha encontrado un endpoint confirmado de notas accesible desde este servicio.
- La evaluación 0.97 es un promedio calculado sobre cuatro dimensiones emitidas por un LLM; sirve como umbral operativo y no como garantía matemática de corrección.
- PDF escaneados requieren OCR, que no está incluido. Un documento sin texto extraíble queda en estado de error con reintentos limitados.
- Si se reinicia `ServiceHomework` mientras envía el webhook o está caído `serviceLLMs`, el envío fire-and-forget puede perderse; la cola Redis protege los trabajos una vez aceptados, pero el esquema actual no tiene outbox transaccional para garantizar entrega entre servicios.
- Los estados se consultan por HTTP. El gateway actual no tiene un canal/evento de progreso específico de trabajos LLM.
