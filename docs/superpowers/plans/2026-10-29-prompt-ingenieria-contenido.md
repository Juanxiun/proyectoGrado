# Prompt de generación de contenido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los prompts de generación de contenido del servicio LLM emitan ejemplos resueltos, fórmulas y preguntas de indagación con el formato pedagógico de ciencias exactas (bloques LaTeX con `$$`, sin fracciones planas, diagramas ASCII/Mermaid, flujo de ejemplificación con microaprendizaje).

**Architecture:** Edición in-place de los prompts `ServiceAcademicLLMs/prompts/gemma/learning_content.txt` y `ServiceAcademicLLMs/prompts/mistral/personalize_content.txt`. Sin cambios de esquema, cliente ni backend.

**Tech Stack:** Python 3.12+, FastAPI, Ollama (structured output con JSON schema), Pydantic.

**Spec:** `docs/superpowers/specs/2026-10-29-prompt-ingenieria-contenido-design.md`

## Global Constraints

- Strings, comentarios y vocabulario en español.
- No usar conocimiento externo; conservar fórmulas y datos de la evidencia.
- No SVG, no frontend, no backend.
- `OllamaClient.structured` fuerza: `"\nDevuelve únicamente JSON válido que cumpla exactamente el esquema solicitado. No uses Markdown."` → el prompt debe expresar LaTeX dentro de strings JSON y diagramas como texto plano.
- Límites de salida: `RefinedContent` 2200 tokens; `LearningUnit` explanation ≤320; `InquiryQuestionDetail.respuesta` ≤400.

## Review Focus

1. Fracciones planas o ecuaciones continuas en una línea → bloques `$$` con fracciones y raíces verticales.
2. Instrucciones de formato pesa en el límite de salida de Gemma (`RefinedContent` 2200 tokens) frente a la longitud de los ejemplos.
3. Cómo se representa diagrama Mermaid/ASCII dentro de los strings JSON de salida.

## Tasks

### Task 1: Prompt de generación de contenido de Gemma

**Files:**
- Modify: `ServiceAcademicLLMs/prompts/gemma/learning_content.txt`

**Interfaces:**
- Consumes: evidencia en `{{context}}`, salida `RefinedContent`.
- Produces: prompt con bloque pedagógico y estructura de preguntas de indagación.

- [ ] **Step 1: Añadir formato pedagógico y reforzar ejemplos/microlearning**
  - Incluir rol de profesor de ciencias exactas pedagógico y visual.
  - Prohibir fracciones planas y ecuaciones continuas en una sola línea.
  - Exigir bloques LaTeX con `$$` para fracciones y raíces; operación en línea propia.
  - Exigir diagrama ASCII/Mermaid para funciones, vectores o geometría.
  - Reforzar `examples_blackboard` con ejercicio resuelto (Enunciado/Paso/Resultado) y ejemplificación en microlearning.

- [ ] **Step 2: Añadir estructura de preguntas de indagación**
  - Cada pregunta debe incluir: pregunta; resumen del tema en el microlearning; ejemplo cotidiano con Enunciado/Paso/Resultado; ejemplo gráfico si es materia práctica con fórmulas.

- [ ] **Step 3: Verificar**
  - Confirmar que `{{context}}` sigue presente y que el JSON final solicitado se mantiene.

- [ ] **Step 4: Commit**
  ```bash
  git add ServiceAcademicLLMs/prompts/gemma/learning_content.txt docs/superpowers/specs/2026-10-29-prompt-ingenieria-contenido-design.md
  git commit -m "docs: prompt de contenido con formato LaTeX y ejemplificación"
  ```

### Task 2: Prompt de personalización de contenido (Mistral)

**Files:**
- Modify: `ServiceAcademicLLMs/prompts/mistral/personalize_content.txt`

**Interfaces:**
- Consumes: evidencia en `{{context}}`, salida `PersonalizedLearningContent`.
- Produces: prompt con mismo formato pedagógico aplicado.

- [ ] **Step 1: Aplicar formato pedagógico a personalización**
  - Explicación, ejemplos, separación enunciado/pasos/resultado con saltos de línea, fórmulas completas, una operación por línea, sin respuesta de preguntas orientadoras.

- [ ] **Step 2: Verificar**
  - Confirmar que `{{context}}` sigue presente.

- [ ] **Step 3: Commit**
  ```bash
  git add ServiceAcademicLLMs/prompts/mistral/personalize_content.txt
  git commit -m "docs: prompt de personalizacion con formato LaTeX y ejemplificacion"
  ```

### Task 3: Verificación de prompts

**Files:**
- No new files expected.

**Interfaces:**
- Consumes: `app/ollama_client.py` (`structured`, reemplazo de `{{context}}`).

- [ ] **Step 1: Renderizar prompts con contexto de prueba**
  - Simular el reemplazo de `{{context}}` y confirmar que no quedan placeholders.

- [ ] **Step 2: Revisar instrucción JSON vs formato LaTeX/Mermaid**
  - Confirmar que no hay conflicto con "Devuelve únicamente JSON válido... No uses Markdown."

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-29-prompt-ingenieria-contenido.md`. Please review the plan. Does it capture what you want?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** - I implement every task myself in this session, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end. Runs well with a mid-tier session model, since the plan carries the design.

For this plan I recommend **Native**, because the tasks are prompt-text edits with no code interfaces beyond file paths, and the design doc already fixed the wording decisions.

Does the plan capture what you want, and which approach should we use?
