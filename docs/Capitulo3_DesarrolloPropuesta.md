# CAPÍTULO III DESARROLLO DE LA PROPUESTA

## 1. Introducción

El presente capítulo describe el desarrollo de la propuesta del sistema informático educativo, abarcando la construcción del software mediante la metodología ágil Scrumban, la integración de los modelos de lenguaje de gran tamaño mediante LLMOps y la validación final del producto. Se detallan la arquitectura distribuida basada en microservicios, el relevamiento de requerimientos, las historias de usuario y los artefactos de ingeniería generados en cada iteración.

Se abordan seis iteraciones de desarrollo con duración de dos semanas cada una, combinando el flujo continuo y los límites de trabajo en progreso (WIP) de Kanban con las iteraciones fijas de Scrum. A partir de la quinta iteración se incorpora LLMOps para la preparación, evaluación y despliegue de los modelos de lenguaje, junto con la implementación de RAG y cuantización. Finalmente se presentan los resultados de la propuesta, la comparativa antes y después de la implementación y la validación con los usuarios finales.

## 2. Objetivos de la Propuesta

Para el desarrollo de este sistema se definieron cinco objetivos específicos enfocados exclusivamente en el desarrollo técnico:

1. Diseñar la base de datos y la arquitectura distribuida del sistema para cubrir las necesidades del centro educativo.
2. Desarrollar los servicios del sistema mediante microservicios y una API REST, cumpliendo con los requerimientos y diseños establecidos.
3. Implementar el módulo de inteligencia artificial mediante LLMOps, RAG y cuantización para el análisis de documentos académicos y la generación de contenido dinámico.
4. Generar un dashboard de control institucional dirigido al área directiva para la gestión académica y económica.
5. Evaluar los resultados del sistema mediante pruebas de aseguramiento de calidad (SQA) y seguridad, asegurando la calidad del software en UX y seguridad.

## 3. Metodología de Desarrollo del Sistema (Scrumban)

El proyecto adoptó Scrumban por su flexibilidad para el desarrollo individual y su capacidad de combinar iteraciones fijas con flujo continuo. Se definieron seis iteraciones de dos semanas cada una, con un límite de trabajo en progreso (WIP) de una a dos tareas activas por columna. El tablero visual se estructuró en las columnas Backlog, Ready, In Progress, Testing y Done.

Los roles se asignaron a un único desarrollador que asume las funciones de líder de proyecto, arquitecto y programador. Antes de cada iteración se elevan los requerimientos, las historias de usuario y los criterios de aceptación, asegurando trazabilidad entre el backlog y los artefactos de ingeniería. A partir de la quinta iteración se integra LLMOps al flujo Scrumban para el módulo de IA, manteniendo la estructura del tablero.

La duración total del desarrollo abarca del 4 de agosto al 28 de octubre, con cuatro tareas por iteración y cierre de cada ciclo con retrospectiva.

**Figura 3.1. Cronograma de iteraciones del proyecto**

Fuente: Elaboración propia, 2026

**Figura 3.2. Tablero de trabajo Kanban**

Fuente: Elaboración propia, 2026

## 4. Relevamiento de Requerimientos

### 4.1 Definición de Procesos

Los procesos del negocio se identificaron mediante entrevistas al director de la institución y cuestionarios a los estudiantes. Las técnicas de recolección incluyeron entrevistas semiestructuradas y encuestas de satisfacción. Los procesos respaldados son: gestión académica, inscripción de estudiantes, entrega de material, control económico, seguimiento académico, notificaciones y gamificación.

### 4.2 Historias de Usuario y Criterios de Aceptación

El tablero consolidado de historias de usuario sintetiza los requerimientos funcionales y operativos del sistema escolar. Su estructura organiza sistemáticamente las veinticinco historias priorizadas según su identificador, título descriptivo, rol participante, nivel de criticidad, interfaz de acceso y módulo de arquitectura. La especificación técnica exhaustiva y los diagramas de casos de uso se remiten al Apéndice C.

| ID | Título | Rol | Prioridad | Plataforma | Módulo |
|---|---|---|---|---|---|
| HU-01 | Visualizar tablero general de la institución | Director | Alta | Web | Dashboard |
| HU-02 | Gestionar períodos académicos | Director | Alta | Web | Estructura académica |
| HU-03 | Gestionar malla curricular por grado | Director | Alta | Web | Estructura académica |
| HU-04 | Gestionar temas de la malla curricular | Director | Media | Web | Estructura académica |
| HU-05 | Generar estructura de cursos y paralelos | Director | Media | Web | Estructura académica |
| HU-06 | Generar horarios automáticamente | Director | Media | Web | Estructura académica |
| HU-07 | Gestionar planes de pago | Director | Media | Web | Económico |
| HU-08 | Ver panel económico institucional | Director | Media | Web | Económico |
| HU-09 | Gestionar usuarios del sistema | Director | Media | Web | Administración |
| HU-10 | Ver seguimiento académico por curso | Director | Media | Web | Seguimiento |
| HU-11 | Ver mis cursos y materias asignadas | Docente | Media | Web | Cursos |
| HU-12 | Gestionar materiales pedagógicos | Docente | Media | Web | Materias/evaluaciones |
| HU-13 | Crear y gestionar evaluaciones/encargos | Docente | Media | Web | Materias/evaluaciones |
| HU-14 | Revisar y calificar entregas de estudiantes | Docente | Alta | Web | Evaluaciones |
| HU-15 | Gestionar inscripciones de estudiantes | Director | Alta | Web | Inscripciones |
| HU-16 | Registrar y verificar pagos | Director | Alta | Web | Económico |
| HU-17 | Recibir notificaciones académicas | Estudiante | Media | Móvil | Notificaciones |
| HU-18 | Consultar material académico personalizado | Estudiante | Alta | Móvil | Materiales |
| HU-19 | Resolver retos con LLM | Estudiante | Alta | Móvil | Aprendizaje |
| HU-20 | Ver ranking y gamificación | Estudiante | Media | Móvil | Gamificación |
| HU-21 | Consultar horarios y cursos | Estudiante | Media | Móvil | Cursos |
| HU-22 | Enviar entregas de tareas | Estudiante | Alta | Móvil | Tareas |
| HU-23 | Recibir retroalimentación del modelo | Estudiante | Alta | Móvil | Aprendizaje |
| HU-24 | Gestionar perfiles de usuario | Director | Media | Web | Administración |
| HU-25 | Monitorear rendimiento del sistema | Director | Media | Web | Dashboard |

### 4.3 Requerimientos Funcionales y No Funcionales

Requerimientos funcionales:

- RF-01: El sistema debe permitir listar y organizar a los usuarios según sus roles (control, docentes y estudiantes).
- RF-02: El sistema debe restringir el acceso a las funcionalidades según el rol del usuario.
- RF-03: El sistema debe permitir administrar la gestión académica vigente y controlar el avance de los trimestres.
- RF-04: El sistema debe permitir crear una nueva gestión académica y habilitar las inscripciones.
- RF-05: El sistema debe permitir gestionar el material académico según la materia y el curso.
- RF-06: El sistema debe analizar el material educativo para apoyar la generación de contenido mediante LLMs.
- RF-07: El sistema debe ofrecer contenido personalizado según el ritmo de aprendizaje del estudiante.
- RF-08: El sistema debe permitir gestionar los pagos de las mensualidades.
- RF-09: El sistema debe generar reportes semanales del desarrollo del trimestre.

Requerimientos no funcionales:

- RNF-01: Tiempo de respuesta igual o inferior a 500 ms bajo alta concurrencia.
- RNF-02: Procesar correctamente al menos el 92 % de las peticiones a la base de datos.
- RNF-03: El análisis de documentos para LLMs debe ejecutarse en segundo plano en 5 a 10 minutos.
- RNF-04: Validar autenticación mediante JWT.
- RNF-05: Validar entradas de datos para prevenir inyección SQL.
- RNF-06: Analizar archivos antes de su carga para prevenir archivos maliciosos.
- RNF-07: Limitar peticiones por IP frente a ataques DDoS.
- RNF-08: Mantener funcionamiento ante la interrupción temporal de un servicio.

### 4.4 Arquitectura del Sistema

Se adoptó una arquitectura de microservicios distribuida. El frontend móvil en React Native se comunica con un gateway REST en ASP.NET Core, el cual enruta las peticiones a los servicios Deno (Oak) y al servicio Python de LLMs. La persistencia se centraliza en PostgreSQL (ShalomDB y ShalomDBGM), con Redis para caché y colas, MinIO para objetos y Ollama para la inferencia de modelos. La arquitectura es esencial para el negocio porque permite escalar de forma independiente cada módulo, aislar fallos y desplegar mediante contenedores Docker.

**Figura 3.3. Diagrama de arquitectura del sistema**

Fuente: Elaboración propia, 2026

### 4.5 Stack Tecnológico

| Tecnología | Versión | Justificación |
|---|---|---|
| React Native / Expo | 0.88 / SDK 58 | Desarrollo móvil multiplataforma con hot reload |
| ASP.NET Core (.NET) | net10.0 | Gateway REST de alto rendimiento |
| Deno / Oak | 2.x | Servicios backend ligeros con TypeScript |
| Python / FastAPI | 3.12+ | Servicio de LLMs y pipeline RAG |
| PostgreSQL | 16 | Persistencia relacional centralizada |
| Redis | 7 | Caché, colas y vector store |
| MinIO | Latest | Almacenamiento de objetos |
| Ollama | Latest | Inferencia local de modelos LLM |
| Docker | Latest | Contenerización y despliegue |

## 5. Desarrollo de la Propuesta (Iteraciones Scrumban)

### Iteración 1: Estructura base, núcleo de datos y contenedores

**Metas de la iteración:** Definir los esquemas de base de datos, estructurar los servicios backend, dockerizar la API REST y inicializar la aplicación móvil.

**Tablero Scrumban:** Backlog: definición de esquemas; Ready: servicios backend; In Progress (WIP 2): dockerización y frontend; Testing: conectividad; Done: infraestructura validada.

**Historias de Usuario y Requerimientos:** HU-02, HU-03, HU-09. Matriz: HU-02 → RF-03, HU-03 → RF-03, HU-09 → RF-01.

**Artefactos de Ingeniería:** Diagrama UML de casos de uso del módulo de infraestructura, diagrama de clases del modelo de datos, diagrama de secuencia del flujo de conexión gateway-servicios, diagrama de tiempos de la iteración.

**Figura 3.4. Diagrama UML de casos de uso - Iteración 1**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Configuración del gateway REST y conexión a la base de datos.

```csharp
// Program.cs -> configuracion del gateway REST
app.MapControllers();
```

**Interfaz de Usuario (UI):** Pantalla inicial de la aplicación móvil con conexión al gateway.

**Pruebas SQA:**

| Caso de Prueba | Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|
| PR-SQA-1.1 Gateway | 50 req concurrentes | HTTP 200 | Latencia 32 ms, 0% errores | Cumple |
| PR-SQA-1.2 Persistencia | 30 conexiones | Reconexión automática | Reconexión en 410 ms | Cumple |
| PR-SQA-1.3 MinIO | 20 escrituras | Persistencia íntegra | Tiempo medio 84 ms | Cumple |

**Resumen de Pruebas:** Se realizaron 3 pruebas de calidad, confirmándose que el 100 % de las pruebas fueron exitosas (Cumple completamente).

**Retrospectiva:** Aspectos positivos: infraestructura estable y despliegue modular. Desafíos: configuración de redes Docker. Oportunidades: automatizar el despliegue.

### Iteración 2: Autenticación, usuarios y gestión académica

**Metas:** Implementar el módulo de autenticación, administración de usuarios (CRUD) y gestión académica con generación automatizada.

**Tablero Scrumban:** Backlog: CRUD usuarios; Ready: autenticación JWT; In Progress (WIP 2): gestión académica; Testing: validación de roles; Done: módulo operativo.

**Historias de Usuario:** HU-09, HU-11, HU-24. Matriz: HU-09 → RF-01, RF-02; HU-11 → RF-03; HU-24 → RF-01.

**Artefactos de Ingeniería:** Diagramas UML de casos de uso, clases y secuencia del flujo de autenticación.

**Figura 3.5. Diagrama de secuencia - Autenticación**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Validación de JWT en el servicio de usuarios.

```typescript
// auth.ts -> validacion de token JWT
const payload = await verifyToken(token);
```

**Interfaz de Usuario (UI):** Pantallas de inicio de sesión y gestión de usuarios.

**Pruebas SQA:** 4 pruebas realizadas, 100 % exitosas (Cumple completamente).

**Retrospectiva:** Positivo: autenticación robusta. Desafíos: sincronización de roles. Mejora: centralizar permisos.

### Iteración 3: Inscripciones y material académico

**Metas:** Implementar la gestión e inscripción de estudiantes (manual y automatizada) y la entrega de material académico segmentado por curso.

**Tablero Scrumban:** Backlog: inscripciones; Ready: material académico; In Progress (WIP 2): segmentación; Testing: flujos; Done: módulo completo.

**Historias de Usuario:** HU-12, HU-15, HU-18, HU-22. Matriz: HU-12 → RF-05; HU-15 → RF-04; HU-18 → RF-05, RF-07; HU-22 → RF-05.

**Artefactos de Ingeniería:** Diagramas UML de casos de uso, clases y secuencia del flujo de inscripción.

**Figura 3.6. Diagrama de flujo - Inscripción de estudiantes**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Servicio de inscripción automatizada.

```typescript
// inscripcion.service.ts -> registro de estudiante
await registrarInscripcion(data);
```

**Interfaz de Usuario (UI):** Pantallas de inscripción y consulta de material.

**Pruebas SQA:** 5 pruebas realizadas, 100 % exitosas (Cumple completamente).

**Retrospectiva:** Positivo: automatización de inscripciones. Desafíos: validación de datos. Mejora: pruebas de carga.

### Iteración 4: Control económico, seguimiento y notificaciones

**Metas:** Integrar el servicio económico, el módulo de seguimiento académico, el dashboard informativo y el sistema de notificaciones.

**Tablero Scrumban:** Backlog: control económico; Ready: seguimiento; In Progress (WIP 2): dashboard y notificaciones; Testing: integración; Done: módulo operativo.

**Historias de Usuario:** HU-07, HU-08, HU-10, HU-16, HU-17. Matriz: HU-07 → RF-08; HU-08 → RF-09; HU-10 → RF-09; HU-16 → RF-08; HU-17 → RF-03.

**Artefactos de Ingeniería:** Diagramas UML de casos de uso, clases y secuencia del flujo de notificaciones.

**Figura 3.7. Diagrama de secuencia - Notificaciones**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Publicación de eventos en el canal de notificaciones.

```typescript
// notificaciones.service.ts -> publicacion de evento
await publishEvento('notificaciones:eventos', payload);
```

**Interfaz de Usuario (UI):** Dashboard institucional y panel de notificaciones.

**Pruebas SQA:** 5 pruebas realizadas, 100 % exitosas (Cumple completamente).

**Retrospectiva:** Positivo: dashboard funcional. Desafíos: latencia de notificaciones. Mejora: caché Redis.

### Iteración 5: Implementación e Integración de LLMOps

**Fundamentos y Selección Metodológica de LLMOps:** Se adoptó un flujo de trabajo de LLMOps que incluye preparación de datos, ingeniería de prompts, RAG, evaluación y despliegue. Se compararon modelos base y se seleccionó Mistral 7B para retroalimentación y Gemma para generación paralela.

**Precarga y Evaluación de Modelos:** Se realizaron pruebas comparativas de latencia y precisión, cargando el modelo base en Ollama con cuantización para reducir la huella de memoria.

**Ingeniería de Prompts:** Se diseñaron plantillas de prompts estructuradas para generación de resúmenes, quizzes y retroalimentación personalizada.

**RAG (Retrieval-Augmented Generation):** Se implementó búsqueda vectorial con Redis como vector store, embeddings de los documentos y recuperación de contexto para enriquecer las respuestas del modelo.

**Cuantización:** Se aplicó cuantización al modelo para reducir la huella de memoria y optimizar los tiempos de inferencia.

**Metas de la iteración:** Integrar los servicios LLM, el módulo de evaluaciones automatizadas con resúmenes personalizados y el componente de detección de anomalías.

**Tablero Scrumban:** Backlog: preparación de datos; Ready: prompts; In Progress (WIP 2): RAG y cuantización; Testing: precisión; Done: módulo LLM operativo.

**Historias de Usuario (LLM):** HU-19, HU-23. Matriz: HU-19 → RF-06, RF-07; HU-23 → RF-07.

**Artefactos de Ingeniería:** Diagramas UML y de arquitectura del pipeline RAG/LLM.

**Figura 3.8. Arquitectura del pipeline RAG/LLM**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Pipeline de embeddings y recuperación de contexto.

```python
# pipeline.py -> recuperacion de contexto RAG
context = retrieve_context(query, top_k=5)
```

**Interfaz de Usuario (UI):** Chat interactivo y resultados del LLM en la aplicación móvil.

**Pruebas SQA:**

| Caso de Prueba | Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|
| PR-SQA-5.1 Latencia | Consulta LLM | < 90 s | Generación en segundo plano | Cumple |
| PR-SQA-5.2 Precisión | Documento académico | Respuesta contextualizada | RAG recuperó contexto válido | Cumple |
| PR-SQA-5.3 Cuantización | Modelo cuantizado | Reducción de memoria | Huella reducida | Cumple |

**Resumen de Pruebas:** Se realizaron 3 pruebas de rendimiento y precisión, confirmándose que el 100 % de las pruebas fueron exitosas (Cumple completamente).

**Retrospectiva:** Análisis de rendimiento: latencia controlada mediante procesamiento en segundo plano. Latencia: Mistral a ~7 tok/s. Ajuste del modelo: prompts optimizados y RAG efectivo.

### Iteración 6: Gamificación, compilación y entrega final

**Metas:** Añadir el servicio de gamificación vinculado a las evaluaciones con LLM, compilar la aplicación móvil, separar pantallas e interfaces y ajustar restricciones de acceso.

**Tablero Scrumban:** Backlog: gamificación; Ready: compilación; In Progress (WIP 2): vistas por rol; Testing: restricciones; Done: entrega final.

**Historias de Usuario:** HU-20, HU-21. Matriz: HU-20 → RF-07; HU-21 → RF-03.

**Artefactos de Ingeniería:** Diagramas UML de casos de uso y secuencia del flujo de gamificación.

**Figura 3.9. Diagrama de flujo - Gamificación**

Fuente: Elaboración propia, 2026

**Fragmento de Código:** Otorgamiento de puntos por reto completado.

```typescript
// gamificacion.service.ts -> otorgar puntos
await otorgarPuntos(usuarioId, puntos);
```

**Interfaz de Usuario (UI):** Pantallas de ranking, gamificación y restricción de acceso móvil.

**Pruebas SQA:** 4 pruebas realizadas, 100 % exitosas (Cumple completamente).

**Retrospectiva:** Positivo: gamificación completa. Desafíos: lógica de racha. Mejora: pruebas de carga sobre el ranking.

## 6. Resultados de la Propuesta

La implementación del sistema transformó los procesos operativos del centro educativo. Antes de la implementación, la gestión académica, las inscripciones y el control económico se realizaban de forma manual, con tiempos de respuesta elevados y propensión a errores. Tras la puesta en marcha, los procesos se automatizaron, reduciendo los tiempos de registro y consulta, y centralizando la información en un único sistema accesible por roles.

Los tiempos de respuesta del gateway se mantuvieron por debajo de los 500 ms en condiciones de carga, y el procesamiento de documentos para los modelos LLM se realizó en segundo plano dentro del rango de 5 a 10 minutos. Las pruebas de SQA confirmaron el cumplimiento del 100 % de los casos de prueba en las seis iteraciones, validando la estabilidad, la seguridad y el rendimiento del sistema.

La validación con los usuarios finales evidenció un alto nivel de satisfacción y aceptación del sistema. Los directivos destacaron la claridad del dashboard y el control económico, los docentes valoraron la gestión de materiales y evaluaciones, y los estudiantes reportaron una experiencia positiva con el contenido personalizado y la gamificación. Los resultados respaldan el cumplimiento de los objetivos establecidos en la propuesta.