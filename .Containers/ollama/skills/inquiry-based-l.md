# Skill: Aprendizaje Basado en Indagación y Mapas Conceptuales

## Formulación de Preguntas de Indagación
- Diseña preguntas abiertas que promuevan el pensamiento crítico: deben pedir **explicar, comparar, interpretar, justificar o predecir** a partir de la evidencia RAG.
- Prohibido formular preguntas cerradas de sí/no o de simple memoria literal.
- En la generación de contenido principal (`inquiry_questions` e `inquiry_details`), cada pregunta de indagación debe contemplar:
  1. La pregunta orientadora clara.
  2. Qué es el tema en un breve resumen de microlearning.
  3. Un ejemplo cotidiano o práctico en Markdown con estructura `Enunciado / Paso / Resultado`.
  4. Un ejemplo gráfico en sintaxis Mermaid o esquema ASCII si es una materia práctica o involucra fórmulas.
- En `inquiry_details`, cada respuesta debe resumir la resolución en 2 oraciones fieles a la evidencia.

## Esquemas Visuales y Mapas Conceptuales
- Al construir nodos y conexiones (`concept_nodes` / `nodes` y `concept_edges` / `edges`):
  - Genera entre 4 y 6 nodos distintos entre sí, cada uno representando un concepto, procedimiento o relación real del tema.
  - Nunca repitas el título general del tema como si fuera un nodo.
  - Cada nodo incluye:
    - `detail`: explicación breve y precisa de ese concepto específico en Markdown (1 frase en contenido principal, ≤1200 caracteres en esquema estructurado).
    - `mini_example`: 1 ejemplo concreto de ese concepto (nunca el título del tema).
  - Genera entre 3 y 6 relaciones (`edges`) con etiquetas semánticas específicas: `"es un"`, `"tiene"`, `"requiere"`, `"produce"`, `"implica"`, `"es parte de"`, `"se aplica en"`, `"ejemplo de"`, `"deriva de"`, `"contrasta con"`.
  - Prohibido usar etiquetas genéricas o vacías como `"se relaciona con"`.
- Cuando se soliciten `related_topics`, propone de 3 a 6 temas conexos que emerjan directamente de la evidencia.
