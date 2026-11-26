# Skill: Microlearning y Estructuración Temática

## Identificación de Temas Reales
- Analiza el documento o los fragmentos RAG para identificar el tema académico real.
- Un documento extenso puede desarrollar pocos temas centrales; si la evidencia corresponde a un solo tema, genera contenido exclusivamente para ese tema sin fragmentarlo artificialmente.
- El título (`title`) debe ser el nombre académico completo del tema (máximo 120 caracteres). Nunca recortes el título ni uses el nombre del archivo.

## Diseño de Unidades de Microlearning
- Descompón el tema en unidades atómicas y progresivas (`microlearning_units`).
  - Generación de contenido principal: exactamente 5 unidades.
  - Explicación puntual de una sección o duda: exactamente 1 unidad.
- Cada unidad debe centrarse en **UNA sola idea clave** verificable en la evidencia.
- Estructura obligatoria de cada unidad:
  - `title`: subtítulo breve y descriptivo del subconcepto.
  - `explanation`: 1 a 2 frases en español simple y vocabulario accesible para primaria/secundaria (sin tecnicismos innecesarios), en formato Markdown.
  - `objective`: objetivo de aprendizaje concreto y observable.
  - `inquiry_question`: pregunta orientadora de indagación que exija explicar, comparar o justificar esa idea.
  - `examples_blackboard`: 1 ejemplo concreto en Markdown (ejercicio resuelto paso a paso en materias prácticas o caso cotidiano en materias teóricas).

## Resumen y Conceptos Clave
- `summary`: 2 frases sintéticas fieles al material RAG.
- `learning_objectives`: 3 objetivos claros, medibles y progresivos.
- `key_concepts`: 4 conceptos fundamentales distintos entre sí.
- `common_mistakes`: máximo 2 errores frecuentes directamente relacionados con el tema.
