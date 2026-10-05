# serviceLLMs

Servicio Python asíncrono para procesar materiales académicos cargados en `ServiceHomework`. El repositorio no tenía un índice RAG, modelos de cuestionario, historial de intentos ni perfiles pedagógicos; este servicio introduce el primer índice vectorial en Redis Stack y conserva los IDs académicos que ya entrega el backend.

## Flujo disponible

1. `ServiceHomework` guarda el material y responde al profesor sin esperar al servicio LLM.
2. En segundo plano envía `content.created` a `POST /webhooks/content-created`. El webhook valida `X-Webhook-Secret`, registra un trabajo idempotente en un Redis Stream y devuelve `202`.
3. Un worker con concurrencia acotada descarga el archivo desde MinIO, extrae texto de PDF, DOCX, XLSX, XLS o CSV y aplica chunking con overlap.
4. Gemma sintetiza cada fragmento; Mistral produce una guía de microlearning y preguntas; Gemma evalúa fidelidad, cobertura, coherencia y pedagogía. El promedio interno de los cuatro criterios se compara con 0.97 hasta el máximo configurado.
5. Al aprobar la evaluación, los fragmentos del documento docente se vectorizan en Redis Stack. La guía validada y el banco de 20 preguntas quedan guardados en claves `shalom:rag:*`.
6. Un servicio de prueba emite 5 o 6 preguntas inéditas para cada alumno y contenido. Las respuestas correctas se guardan solo en Redis; el endpoint devuelve enunciados y opciones. Se ignoran preguntas utilizadas y se generan preguntas adicionales con Mistral cuando el banco se agota.
7. El webhook de prueba valida la respuesta contra el cuestionario emitido. Al completar cada cuatro cuestionarios diferentes, un worker calcula el perfil de aprendizaje y lo guarda bajo el par alumno/contenido; posteriormente actualiza el vector del perfil. El nivel recomendado usa los umbrales configurados.
8. La generación personalizada combina guía docente aprobada, fragmentos del documento fuente y perfil del alumno. El resultado se almacena por alumno/contenido y versión del perfil.

Al arrancar, `serviceLLMs` crea metadatos y cinco ramas base en Redis: `knowledge`, `subjects`, `topics`, `students` y `methodology`. Un chequeo en segundo plano valida los modelos instalados y ejecuta una inferencia breve con Gemma y Mistral más una solicitud de embedding; si Redis/Ollama no están disponibles, se reintenta y `/ready` permanece en 503. Ollama indexa las guías pedagógicas en `methodology`. Material docente aprobado agrega fragmentos a `knowledge` y mini-contextos trazables a `subjects` y `topics`; los perfiles aparecen en `students` al completar cuatro cuestionarios únicos.

## Contrato y endpoints

- `GET /health`: proceso vivo.
- `GET /ready`: Redis Stack/Search, esquema base creado, tags instalados y autoprueba real de inferencia Gemma, Mistral y embeddings.
- `GET /rag/structure`: árbol descriptivo de las ramas del RAG y conteo de mini-contextos (requiere `X-Webhook-Secret`).
- `POST /webhooks/content-created`: webhook autenticado, respuesta rápida `202` e idempotencia por `content_id`.
- `GET /jobs/{job_id}`: estado y progreso del pipeline.
- `GET /rag/search?q=...&content_id=...&subject_id=...`: recuperación vectorial acotada.
- `POST /students/{student_id}/contents/{content_id}/quizzes`: emitir prueba (5 o 6 preguntas), autenticada con `X-Webhook-Secret`; el cuerpo debe repetir `student_id`, `content_id` y opcionalmente `question_count`.
- `POST /webhooks/quiz-completed`: registrar respuestas; `attempt_id` debe ser el `quiz_id` recibido al emitir la prueba. Cada respuesta lleva `question_id` y el texto exacto de la opción elegida.
- `GET /students/{student_id}/profiles/{content_id}`: perfil después de completar cuatro pruebas.
- `POST /students/{student_id}/contents/{content_id}/personalized`: generar o recuperar explicación personalizada una vez creado el perfil.

Las rutas de alumnos/cuestionarios y los webhooks están protegidos con el secreto interno. **Todavía no hay proxy en RestApi ni pantallas/contrato de cuestionarios en el Frontend**: no se debe exponer el secreto interno al navegador. Para usarlos desde la aplicación, el gateway debe validar el JWT/rol y reenviar las solicitudes con el secreto guardado solo en el servidor. El repositorio no cuenta actualmente con entidades persistentes para cuestionarios o respuestas; el nuevo flujo conserva sus intentos en Redis por alumno y contenido, sin crear tablas ficticias.

El evento contiene los campos disponibles al crear un material: ID del material, asignación, materia, nivel/grado/paralelo, título, archivo y URL interna de MinIO. La entidad actual no expone un `topic_id`; no se inventa.

## Configuración

`docker-compose.yml` consume estas variables desde `.env`:

| Variable | Uso |
| --- | --- |
| `OLLAMA_BASE_URL` | URL accesible desde los contenedores (por defecto `http://host.docker.internal:11434`). Ollama Desktop debe estar abierto en Windows y aceptar conexiones desde Docker. |
| `OLLAMA_GEMMA_MODEL`, `OLLAMA_MISTRAL_MODEL` | Tags exactos presentes en Ollama. No se descargan modelos automáticamente. |
| `OLLAMA_EMBEDDING_MODEL` | Tag ya instalado que soporte `/api/embed`; necesario para RAG vectorial. |
| `REDIS_RAG_HOST`, `REDIS_RAG_PORT`, `REDIS_RAG_USERNAME`, `REDIS_RAG_PASSWORD` | Redis Stack. Como vive en un compose separado, se usa el puerto publicado del host (`host.docker.internal:6380`), no el DNS `redis_rag` que no comparte red. |
| `LLM_WEBHOOK_SECRET` | Secreto compartido entre `ServiceHomework` y este servicio. Configure un valor aleatorio antes de levantar Docker. |
| `LLM_CHUNK_SIZE`, `LLM_CHUNK_OVERLAP`, `LLM_MAX_CHUNKS_PER_DOCUMENT` | Límites del chunking. |
| `LLM_ACCEPTANCE_THRESHOLD`, `LLM_MAX_REFINEMENT_ITERATIONS` | Umbral de rúbrica (no probabilidad científica) e iteraciones. |
| `LLM_REQUEST_TIMEOUT`, `LLM_MAX_CONCURRENCY`, `LLM_WORKER_COUNT`, `LLM_JOB_MAX_RETRIES` | Límites de ejecución y recuperación. |

La infraestructura existente no declara Ollama ni un modelo de embeddings instalado. Antes de habilitar procesamiento, instala manualmente los modelos elegidos en el host y configura sus tags y `REDIS_RAG_PASSWORD`. La URL/credencial Redis actual del compose externo debe coincidir con esos valores.

Para usar Ollama Desktop en Windows, comprueba que responde en `http://localhost:11434/api/tags` desde el host; dentro del contenedor se accede mediante `http://host.docker.internal:11434`. Ollama debe escuchar en la interfaz de red del host (`OLLAMA_HOST=0.0.0.0:11434` en el entorno con el que se inicia la aplicación) y el firewall debe permitir el puerto 11434 desde Docker. Después de cambiar `OLLAMA_HOST`, reinicia Ollama Desktop. Si no escucha en la interfaz del host, `/ready` permanece en 503 aunque el contenedor esté activo. No se descargan modelos desde el servicio. Los prompts de `prompts/` se cargan al inicio y las guías versionadas modifican su embedding únicamente cuando cambia su texto.

La configuración Docker anterior aplica solo cuando `serviceLLMs` corre dentro de Docker. Si tanto `serviceLLMs` como Ollama Desktop se ejecutan directamente en Windows, no configures Ollama para escuchar en `0.0.0.0`: usa `OLLAMA_BASE_URL=http://127.0.0.1:11434` y `REDIS_HOST=127.0.0.1` (Redis Stack debe publicar su puerto RAG, por defecto 6380). Para arrancar el servicio localmente desde esta carpeta:

```powershell
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
$env:REDIS_HOST = "127.0.0.1"
$env:OLLAMA_EMBEDDING_MODEL = "nomic-embed-text"
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

La prueba `test_full_flow.py` simula Redis y Ollama para validar rápidamente las transiciones. `test_live_integration.py` es una prueba aparte que no usa esos dobles: llama al endpoint real, comprueba Ollama y Redis Stack, ejecuta el pipeline Gemma → Mistral → evaluación → embeddings/Redis Vector Search, crea cuatro cuestionarios por HTTP, espera el perfil y solicita contenido personalizado. También comprueba que el material guardado registra los tags reales de los modelos, la valoración aprobada y el banco de preguntas. Usa IDs aleatorios y elimina las claves y vectores creados al finalizar.

Para ejecutar la integración real:

1. Levanta Redis Stack con el módulo de búsqueda vectorial y Ollama Desktop con Gemma, Mistral y un modelo de embeddings ya instalados. Si ejecutas `serviceLLMs` localmente en Windows, arráncalo con Uvicorn según la sección anterior; si corre en Docker, inicia el contenedor y usa sus direcciones Docker. Configura `OLLAMA_EMBEDDING_MODEL` con el tag compatible con `/api/embed`. Comprueba `http://localhost:8890/ready` y configura un secreto interno no vacío.
2. Configura `OLLAMA_EMBEDDING_MODEL` con el mismo tag de embeddings que usa el servicio Python. En PowerShell, desde `ServiceAcademicLLMs/`, establece `OLLAMA_EMBEDDING_MODEL`, `LLM_INTEGRATION=1`, `LLM_INTEGRATION_BASE_URL=http://127.0.0.1:8890` y `LLM_INTEGRATION_WEBHOOK_SECRET` con el mismo secreto interno del servicio. El proceso Python de pruebas no carga automáticamente el `.env` de la raíz; exportar la variable evita que la prueba use un modelo distinto al servicio. `LLM_INTEGRATION_DOCUMENT_HOST` ahora usa `127.0.0.1` por defecto porque el servicio se ejecuta localmente. Si el servicio Python corre en Docker, establece esa variable como `host.docker.internal`.
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
