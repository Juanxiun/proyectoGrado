# Diseño — Prompt de generación de contenido (LaTeX, diagramas y ejemplificación)

## Intent y por qué
La generación de contenido del servicio LLM produce ejemplos y fórmulas con formato plano y ecuaciones en una sola línea, sin bloques LaTeX ni representación visual. El prompt actual exige pasos numerados pero sin formato matemático. El objetivo es que la explicación de dudas del estudiante use el formato del profesor de ciencias exactas: bloques LaTeX con `$$`, sin fracciones planas, un paso u operación por línea, diagramas ASCII/Mermaid para funciones y vectores, y flujo de ejemplificación con microaprendizaje.

## Alcance (dentro)
1. `ServiceAcademicLLMs/prompts/gemma/learning_content.txt`.
2. `ServiceAcademicLLMs/prompts/mistral/personalize_content.txt`.
3. Instrucciones de formato y estructura de preguntas de indagación dentro de esas dos salidas.

## Fuera de alcance
- Prompts de `explain_section`, `activity_generation` y `restructure_quiz`.
- Frontend y SVG backend (`_svg_pedagogico_nativo`).
- Cambios de esquemas ni backend.

## Restricciones
- `OllamaClient.structured` fuerza JSON válido y "No uses Markdown"; el instructivo debe expresar LaTeX dentro de strings JSON y diagramas como texto plano.
- Límites de salida: `RefinedContent` 2200 tokens, `LearningUnit` explanation ≤320, `InquiryQuestionDetail.respuesta` ≤400.
- Conservar "No uses conocimiento externo" y fidelidad a la evidencia.

## Partes del cómo (acuerdos de diseño)

### Formato pedagógico en content y personalización
- Rol: profesor de ciencias exactas pedagógico y visual.
- Prohibición de fracciones planas y de ecuaciones continuas en una línea; bloques `$$`; operación en línea propia.
- Diagramas ASCII/Mermaid para funciones, vectores o geometría en campos de ejemplo.
- Ejemplificación: concepto pequeño + ejercicio resuelto paso a paso; teoría → analogía cotidiana; historia → fechas con conceptos.

### Preguntas de indagación
Estructura de cada pregunta de indagación:
1. Pregunta en sí.
2. Resumen del tema en el resumen de microlearning.
3. Ejemplo cotidiano con la estructura Enunciado/Paso/Resultado existente.
4. Ejemplo gráfico cuando la materia es práctica y maneja fórmulas.

## Qué se deja al builder
- Texto final del instructivo.
- Representación exacta de Mermaid dentro de los strings JSON.

## Aprobación requerida
Nada se construye hasta que confirmes este diseño.
