# Skill: Aprendizaje Basado en Ejemplos, Ejercicios y Actividades Gamificadas

## Ejemplos en Pizarra (`examples_blackboard` / `examples`)
- **Materias prácticas (matemáticas, física, química, contabilidad):**
  - Muestra siempre un ejercicio resuelto con datos pequeños, concretos y fieles a la evidencia RAG, con pasos numerados en Markdown y saltos de línea reales (`\n`):
    **Enunciado:** [dato concreto del tema]\n**Paso 1:** [acción y operación en $$...$$]\n**Paso 2:** [acción y operación en $$...$$]\n**Resultado:** [valor final en $$...$$]
  - Todas las fórmulas van en bloques `$$...$$` y cada operación en su propia línea.
  - Prohibido incluir párrafos de teoría, fórmulas sueltas sin datos o enunciados genéricos como "Calcular x".
- **Materias teóricas:**
  - Presenta un caso cotidiano concreto de 1 a 2 oraciones que ilustre directamente el concepto.

## Generación de Actividades Evaluativas (`activities`)
- Cada actividad evalúa una idea distinta de la evidencia RAG y debe incluir `source_chunk_ids` con al menos un `chunk_id` real de la evidencia.
- En materias prácticas usa procedimientos sencillos del material con números pequeños.
- **Formatos permitidos (incluir al menos uno de cada tipo cuando se genera un banco):**
  1. `SELECCION_MULTIPLE`: pregunta específica, exactamente 4 opciones (`options`), `correct_answer` idéntico a una opción, 3 distractores plausibles y `explanation` de 1 oración.
  2. `COMPLETAR`: oración con UN SOLO espacio `_____`, exactamente 4 opciones breves, `correct_answer` idéntico a una opción (máximo 4 palabras) y `explanation` de 1 oración.
  3. `DRAG_AND_DROP`: pregunta explicativa que indique QUÉ se ordena, POR QUÉ y PARA QUÉ; `items` con 3 a 5 pasos concretos de un procedimiento real (nunca palabras sueltas); `correct_order` con los mismos textos en el orden lógico correcto; `explanation` de 1 oración.
  4. `CONECTAR_FRASES`: instrucción clara y entre 3 y 5 pares distintos `{left (máx. 5 palabras), right (máx. 15 palabras)}` verificables con la evidencia. Nunca generar solo 2 pares.
- **Formatos prohibidos en generación de banco:** `CUESTIONARIO`, `FLASHCARD`, `VERDADERO_FALSO`.

## Reestructuración Gamificada de Cuestionarios
- Al reestructurar bancos validados de 20 preguntas en 5 a 6 actividades gamificadas, utiliza cada pregunta original exactamente una vez, sin repetir más de 2 veces un mismo formato y con dificultad progresiva (`inicial` = 5 pts, `intermedia` = 7 pts, `avanzada` = 10 pts):
  - `COMPLETAR_PARRAFO`: párrafo en Markdown con 3-5 huecos `_____`, lista de `huecos` (`respuesta`, `pista`) y `word_bank`.
  - `RESOLVER_EJERCICIO`: `enunciado` + 3-6 `pasos` numerados (`orden`, `texto`, `respuesta_esperada`) + `formula` en bloque `$$...$$`.
  - `CONECTAR_PUNTOS`: 4-6 `pares` (`izquierda`, `derecha`) + `instruccion`.
  - `ACOMODAR_FORMULA`: 4-6 `items` desordenados + `orden_correcto` + `instruccion`.
