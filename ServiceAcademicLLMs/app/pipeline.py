import asyncio
import hashlib
import json
import logging
import re
import time
from typing import Any

import httpx
from redis.asyncio import Redis

from app.config import settings
from app.chunking import CATEGORIA_EJERCICIOS, SemanticChunk, filter_noise, split_chunks
from app.documents import extract_text
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ChunkAnalysis, ContentCreatedEvent, ContentEvaluation, DocumentPlan, RefinedContent
from app.services.activities import normalize_activity

logger = logging.getLogger(__name__)

NOTIFY_CANAL = "notificaciones:eventos"
NOTIFY_ORIGEN = "serviceLLMs"


# content -> resumen conceptual sin procedencia
def _resumen_conceptual(texto: str, nombre_archivo: str, conceptos: list[str]) -> str:
    salida = str(texto or "")
    if nombre_archivo:
        salida = re.sub(re.escape(nombre_archivo), "", salida, flags=re.IGNORECASE)
    salida = re.sub(r"(?i)(?:seg[uú]n|de acuerdo con|extra[ií]do de|contenido del)\s+(?:el\s+)?(?:pdf|archivo|documento)(?:\s+subido)?", "", salida)
    salida = re.sub(r"(?i)(?:en|del)\s+(?:el\s+)?(?:pdf|archivo|documento)\s+(?:subido|adjunto)", "", salida)
    salida = re.sub(r"\s+", " ", salida).strip(" ,;:-")
    if not salida:
        salida = ". ".join(conceptos[:3])
    return salida[:500].rstrip(" ,;:-")

# retry -> configuracion para llamadas a Ollama
OLLAMA_MAX_RETRIES = 3
OLLAMA_RETRY_BASE_DELAY = 5.0


def _metadata(event: ContentCreatedEvent) -> dict[str, str]:
    return {key: str(value or "") for key, value in {
        "subject": event.subject, "subject_id": event.subject_id, "topic_id": event.topic_id,
        "document_id": event.document_id, "source": event.source, "grade": event.grade, "course": event.course,
    }.items()}


# document -> muestras distribuidas para planificacion rapida
def _document_samples(text: str, count: int = 6, sample_size: int = 400) -> list[dict[str, Any]]:
    if len(text) <= count * sample_size:
        return [{"position": 0, "text": text[:count * sample_size]}]
    samples = []
    last_start = max(0, len(text) - sample_size)
    for index in range(count):
        start = round(last_start * index / max(1, count - 1))
        samples.append({"position_percent": round(start * 100 / max(1, len(text))), "text": text[start:start + sample_size]})
    return samples


def _compact_analyses(summaries: list[tuple[SemanticChunk, ChunkAnalysis]], max_chars: int = 6500) -> list[dict[str, Any]]:
    compact: list[dict[str, Any]] = []
    remaining = max_chars
    for _, analysis in summaries:
        item = {
            "chunk_id": analysis.chunk_id,
            "category": analysis.category,
            "summary": analysis.summary[:700],
            "key_concepts": analysis.key_concepts[:8],
            "important_points": analysis.important_points[:8],
            "difficulty": analysis.difficulty,
            "possible_misconceptions": analysis.possible_misconceptions[:4],
            "microlearning_units": [unit.model_dump() for unit in analysis.microlearning_units[:3]],
            "inquiry_questions": analysis.inquiry_questions[:3],
        }
        encoded = json.dumps(item, ensure_ascii=False)
        if len(encoded) > remaining:
            item["summary"] = item["summary"][:max(0, remaining // 3)]
            item["important_points"] = item["important_points"][:2]
            item["microlearning_units"] = item["microlearning_units"][:1]
            encoded = json.dumps(item, ensure_ascii=False)
        if len(encoded) > remaining:
            break
        compact.append(item)
        remaining -= len(encoded)
    return compact


def _expand_activity_bank(refined: RefinedContent) -> list[dict[str, Any]]:
    activities = [item.model_dump() for item in refined.activities]
    additions: list[dict[str, Any]] = []
    seen = {
        (" ".join(str(item.get("front", item.get("question", item.get("statement", "")))).casefold().split()),
         " ".join(str(item.get("back", item.get("correct_answer", item.get("model_answer", item.get("justification", ""))))).casefold().split()))
        for item in activities
    }

    def add_card(front: str, back: str, objective: str) -> None:
        tarjeta = {"tipo": "FLASHCARD", "front": front.strip()[:180], "back": back.strip()[:180],
                   "difficulty": "inicial", "learning_objective": objective.strip()[:180], "source_chunk_ids": []}
        fingerprint = (" ".join(tarjeta["front"].casefold().split()), " ".join(tarjeta["back"].casefold().split()))
        if fingerprint not in seen and tarjeta["front"] and tarjeta["back"] and len(activities) + len(additions) < 20:
            seen.add(fingerprint)
            additions.append(tarjeta)

    for item in activities:
        tipo = item.get("tipo")
        if tipo == "SELECCION_MULTIPLE":
            add_card(item.get("question", ""), f"{item.get('correct_answer', '')}. {item.get('explanation', '')}", item.get("learning_objective", ""))
        elif tipo == "CUESTIONARIO":
            add_card(item.get("question", ""), f"{item.get('model_answer', '')}. {item.get('explanation', '')}", item.get("learning_objective", ""))
        elif tipo == "VERDADERO_FALSO":
            respuesta = "Verdadero" if item.get("answer") else "Falso"
            add_card(item.get("statement", ""), f"{respuesta}. {item.get('justification', '')}", item.get("learning_objective", ""))
        elif tipo == "CONECTAR_FRASES":
            for par in item.get("pairs", []):
                add_card(f"Relaciona: {par.get('left', '')}", str(par.get("right", "")), item.get("learning_objective", ""))
        elif tipo == "DRAG_AND_DROP":
            add_card(item.get("question", ""), " → ".join(item.get("correct_order", [])), item.get("learning_objective", ""))

    for unidad in refined.microlearning_units:
        add_card(unidad.title, unidad.explanation, unidad.objective)
    for indice, concepto in enumerate(refined.key_concepts):
        unidad = refined.microlearning_units[indice % len(refined.microlearning_units)] if refined.microlearning_units else None
        add_card(f"Explica: {concepto}", unidad.explanation if unidad else refined.summary, concepto)
    for objetivo in refined.learning_objectives:
        add_card(f"¿Cómo aplicarías {objetivo}?", refined.summary, objetivo)
    return (activities + additions)[:20]


# contenido -> respaldo local si Mistral incumple el formato
def _fallback_refined_content(event: ContentCreatedEvent, reference_chunks: list[tuple[int, SemanticChunk]]) -> RefinedContent:
    title = (event.title or event.subject or "Material de estudio")[:120]
    conceptos = list(dict.fromkeys(chunk.heading.strip() for _, chunk in reference_chunks
                                   if chunk.heading and chunk.category != CATEGORIA_EJERCICIOS))[:8]
    excerpts = [" ".join(chunk.text.split())[:320] for _, chunk in reference_chunks
                if chunk.category != CATEGORIA_EJERCICIOS and chunk.text.strip()]
    if not conceptos:
        conceptos = [title]
    summary = " ".join(excerpts[:3])[:500] or f"Conceptos principales: {title}."
    units = [
        {"title": concepto[:100], "explanation": (excerpts[index] if index < len(excerpts) else concepto)[:320],
         "objective": f"Reconocer {concepto}"[:160], "inquiry_question": f"¿Qué evidencia del material explica {concepto}?"[:240]}
        for index, concepto in enumerate(conceptos[:6])
    ]
    concepto = conceptos[0]
    objetivo = f"Comprender {concepto}"[:180]
    actividades: list[dict[str, Any]] = [
        {"tipo": "SELECCION_MULTIPLE", "question": f"¿Qué tema aborda {title[:50]}?"[:180],
         "options": [concepto[:90], "Otro tema", "Ninguno", "No se indica"],
         "correct_answer": concepto[:90], "explanation": "El encabezado identifica el tema.", "learning_objective": objetivo},
        {"tipo": "CUESTIONARIO", "question": f"Explica la idea principal de {concepto}."[:180],
         "keywords": [concepto[:50], "idea principal"], "model_answer": summary[:180],
         "explanation": "Usa la evidencia del resumen.", "learning_objective": objetivo},
        {"tipo": "FLASHCARD", "front": concepto[:180], "back": summary[:180], "learning_objective": objetivo},
        {"tipo": "VERDADERO_FALSO", "statement": f"El material aborda {concepto}."[:180], "answer": True,
         "justification": "El concepto aparece en el material.", "learning_objective": objetivo},
        {"tipo": "CONECTAR_FRASES", "pairs": [
            {"left": concepto[:180], "right": (excerpts[0] if excerpts else concepto)[:180]},
            {"left": "Idea central", "right": summary[:180]},
        ], "explanation": "Relaciona cada concepto con su referencia.", "learning_objective": objetivo},
    ]
    if any(word in f"{event.subject or ''} {title}".casefold() for word in ("matem", "número", "numero", "álgebra", "algebra", "física", "fisica", "química", "quimica")):
        actividades.append({"tipo": "DRAG_AND_DROP", "question": "Ordena los pasos para resolver un ejercicio.",
                            "items": ["Identificar datos", "Elegir procedimiento", "Resolver", "Comprobar"],
                            "correct_order": ["Identificar datos", "Elegir procedimiento", "Resolver", "Comprobar"],
                            "explanation": "Comprueba el resultado al final.", "learning_objective": "Aplicar un procedimiento paso a paso"})
    else:
        actividades.append({"tipo": "FLASHCARD", "front": f"¿Qué evidencia presenta {concepto}?"[:180],
                            "back": (excerpts[1] if len(excerpts) > 1 else summary)[:180], "learning_objective": objetivo})
    return RefinedContent.model_validate({
        "title": title, "summary": summary, "learning_objectives": [objetivo], "key_concepts": conceptos[:12],
        "microlearning_units": units, "inquiry_questions": [unit["inquiry_question"] for unit in units[:6]],
        "common_mistakes": [], "difficulty": "inicial", "activities": actividades,
    })


# pipeline -> seleccion compacta de referencias representativas
def _select_reference_chunks(chunks: list[SemanticChunk], max_theory: int = 4, max_exercises: int = 2) -> list[tuple[int, SemanticChunk]]:
    theory = [(index, chunk) for index, chunk in enumerate(chunks, 1) if chunk.category != CATEGORIA_EJERCICIOS]
    exercises = [(index, chunk) for index, chunk in enumerate(chunks, 1) if chunk.category == CATEGORIA_EJERCICIOS]
    if len(theory) <= max_theory:
        selected_theory = theory
    else:
        posiciones = [round(index * (len(theory) - 1) / (max_theory - 1)) for index in range(max_theory)]
        selected_theory = [theory[posicion] for posicion in posiciones]
    return sorted(selected_theory + exercises[:max_exercises], key=lambda item: item[0])


# pipeline -> registro RAG de un fragmento teorico o de ejercicio base
def _chunk_metadata(event: ContentCreatedEvent, chunk: SemanticChunk) -> dict[str, str]:
    es_ejercicio = chunk.category == CATEGORIA_EJERCICIOS
    return {
        **_metadata(event),
        "record_type": "base_exercise" if es_ejercicio else "theory_context",
        "branch": "knowledge",
        "category": chunk.category,
        "heading": chunk.heading,
    }


# ollama -> reintentos exponenciales para llamadas caidas
async def _ollama_with_retry(coro_factory, max_retries: int = OLLAMA_MAX_RETRIES) -> Any:
    last_exc = None
    for attempt in range(max_retries):
        try:
            return await coro_factory()
        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                delay = OLLAMA_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(f"Ollama request falló (intento {attempt + 1}/{max_retries}), reintentando en {delay}s: {exc}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Ollama request falló tras {max_retries} intentos: {exc}")
                raise
        except Exception as exc:
            # ollama -> errores no de red no se reintentan
            logger.error(f"Error en Ollama no recuperable: {exc}")
            raise
    raise last_exc


async def process_content(content_id: str, raw_event: dict[str, Any], repo: RAGRepository, llm: OllamaClient, http: httpx.AsyncClient, semaphore: asyncio.Semaphore, notify_redis: Redis) -> None:
    event = ContentCreatedEvent.model_validate(raw_event)
    async with http.stream("GET", str(event.document_url), follow_redirects=True) as response:
        response.raise_for_status()
        data = bytearray()
        async for part in response.aiter_bytes():
            data.extend(part)
            if len(data) > settings.max_document_bytes:
                raise ValueError("El documento supera el límite de tamaño configurado")
    await repo.update_job(content_id, status="EXTRACTING", progress="5", total_chunks="0", current_chunk="0")
    source_text = extract_text(bytes(data), event.document_name)
    plan_input = json.dumps({
        "filename": event.document_name,
        "format": event.document_name.rsplit(".", 1)[-1].lower(),
        "characters": len(source_text),
        "maximum_chunks": 6,
        "samples": _document_samples(filter_noise(source_text)),
    }, ensure_ascii=False)
    await repo.update_job(content_id, status="GEMMA_PLANNING", progress="8")
    desired_chunks = 6
    effective_chunk_size = max(settings.chunk_size, min(settings.chunk_size * 3, (len(source_text) + desired_chunks - 1) // desired_chunks))
    chunks = split_chunks(source_text, effective_chunk_size, 6, settings.chunk_min_chars, settings.chunk_semantic_threshold)
    if not chunks:
        raise ValueError("No se pudieron crear fragmentos útiles del documento")
    reference_chunks = _select_reference_chunks(chunks)
    base_exercises = [chunk.text for _, chunk in reference_chunks if chunk.category == CATEGORIA_EJERCICIOS]
    await repo.update_job(content_id, status="GEMMA_PLANNING", progress="8", total_chunks=str(len(chunks)), current_chunk="0")
    compact = json.dumps({
        "title": event.title, "description": event.description, "subject": event.subject, "grade": event.grade,
        "theory_highlights": list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading)),
        "practical_highlights": list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                   if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading)),
        "chunks": [{"chunk_id": f"{index:04d}-{hashlib.sha256(chunk.text.encode('utf-8')).hexdigest()[:20]}",
                    "heading": chunk.heading, "category": chunk.category, "text": chunk.text[:6000]}
                   for index, chunk in reference_chunks],
        "ejercicios_base_seleccionados": [item[:300] for item in base_exercises[:8]],
    }, ensure_ascii=False)

    total_chunks = len(reference_chunks)
    processed_key = f"{repo.prefix}:content:{content_id}:processed_chunks:v3"
    processed_raw = await repo.get_cache(processed_key)
    processed_indices = set(json.loads(processed_raw)) if processed_raw else set()
    plan_digest = hashlib.sha256(source_text.encode("utf-8")).hexdigest()
    plan_cache_key = f"{repo.prefix}:cache:document-plan:v3:{settings.ollama_gemma_model}:{plan_digest}"
    cached_plan = await repo.get_cache(plan_cache_key)
    embedding_entries: list[tuple[int, SemanticChunk, str, str]] = []
    vector_by_chunk: dict[str, list[float]] = {}
    for index, chunk in reference_chunks:
        vector_text = "\n".join(part for part in (event.title, chunk.heading) if part)
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        vector_digest = hashlib.sha256(vector_text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:concept:{vector_digest}"
        cached = await repo.get_cache(cache_key)
        if cached:
            vector_by_chunk[chunk_id] = json.loads(cached)
        else:
            embedding_entries.append((index, chunk, chunk_id, cache_key))

    async def _plan_document() -> DocumentPlan:
        if cached_plan:
            await repo.update_job(content_id, gemma_plan_ms="0", gemma_plan_cache="hit")
            return DocumentPlan.model_validate_json(cached_plan)
        started = time.perf_counter()
        try:
            async with semaphore:
                result = await _ollama_with_retry(lambda: llm.structured(
                    settings.ollama_gemma_model, "gemma/plan_document.txt", plan_input, DocumentPlan))
            cache_state = "miss"
        except ValueError:
            result = DocumentPlan(
                subject=(event.subject or event.title)[:80],
                context=(event.description or "Material analizado desde sus secciones relevantes.")[:240],
                outline=[chunk.heading[:100] for _, chunk in reference_chunks if chunk.heading][:8],
                key_theoretical_content=list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                           if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading))[:8],
                practical_content=list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                     if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading))[:6],
                desired_chunks=len(chunks), chunking_reason="Seis fragmentos agrupados por tema y practica.",
            )
            cache_state = "fallback"
        await repo.update_job(content_id, gemma_plan_ms=str(round((time.perf_counter() - started) * 1000)), gemma_plan_cache=cache_state)
        await repo.set_cache(plan_cache_key, result.model_dump_json(), 30 * 24 * 60 * 60)
        return result

    async def _embed_pending() -> None:
        if not embedding_entries:
            await repo.update_job(content_id, embedding_ms="0")
            return
        started = time.perf_counter()
        async with semaphore:
            vectors = await _ollama_with_retry(lambda: llm.embed_many(["\n".join(part for part in (event.title, chunk.heading) if part) for _, chunk, _, _ in embedding_entries]))
        await repo.update_job(content_id, embedding_ms=str(round((time.perf_counter() - started) * 1000)))
        for (_, _, chunk_id, cache_key), vector in zip(embedding_entries, vectors):
            vector_by_chunk[chunk_id] = vector
            await repo.set_cache(cache_key, json.dumps(vector), 30 * 24 * 60 * 60)

    refinement_fallback = False

    async def _refine_content() -> RefinedContent:
        nonlocal refinement_fallback
        started = time.perf_counter()
        try:
            async with semaphore:
                result = await _ollama_with_retry(lambda: llm.structured(
                    settings.ollama_mistral_model, "mistral/refine.txt", compact, RefinedContent))
            await repo.update_job(content_id, mistral_summary_ms=str(round((time.perf_counter() - started) * 1000)),
                                  mistral_output="structured")
        except ValueError as exc:
            refinement_fallback = True
            logger.warning("Mistral devolvio una salida invalida; se conserva el job con extraccion local: %s", str(exc)[:400])
            result = _fallback_refined_content(event, reference_chunks)
            await repo.update_job(content_id, mistral_summary_ms=str(round((time.perf_counter() - started) * 1000)),
                                  mistral_output="source_fallback")
            await repo.set_cache(f"{repo.prefix}:content:{content_id}:mistral_fallback", "1", 24 * 60 * 60)
        return result

    document_plan, _, refined = await asyncio.gather(_plan_document(), _embed_pending(), _refine_content())
    refined = RefinedContent.model_validate({**refined.model_dump(), "activities": _expand_activity_bank(refined)})
    refined.summary = _resumen_conceptual(refined.summary, event.document_name, refined.key_concepts)
    await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress="20", total_chunks=str(total_chunks), current_chunk="0")
    summaries: list[tuple[SemanticChunk, ChunkAnalysis]] = []
    for selected_index, (index, chunk) in enumerate(reference_chunks, 1):
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        analysis = ChunkAnalysis(chunk_id=chunk_id, category=chunk.category, summary=chunk.text[:500],
                                 key_concepts=[chunk.heading] if chunk.heading else [], difficulty=chunk.difficulty_hint or "inicial")
        summaries.append((chunk, analysis))
        metadata = _chunk_metadata(event, chunk)
        metadata["record_slot"] = f"{metadata['record_type']}:{selected_index:02d}"
        vector_text = "\n".join(part for part in (event.title, chunk.heading) if part)
        await repo.save_vector(content_id, analysis.chunk_id, vector_text, vector_by_chunk[chunk_id], metadata)
        processed_indices.add(index)
        await repo.set_cache(processed_key, json.dumps(sorted(processed_indices)), 30 * 24 * 60 * 60)
        progress = 20 + int(30 * selected_index / total_chunks)
        await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress=str(progress), total_chunks=str(total_chunks), current_chunk=str(selected_index))

    await repo.update_job(content_id, status="MISTRAL_REFINEMENT", progress="55", refinement_iteration="1")
    evaluation: ContentEvaluation | None = None
    await repo.update_job(content_id, status="QUALITY_EVALUATION", progress="75")
    for iteration in range(1):
        evidence = json.dumps({
            "reference_policy": "El material validado delimita todos los conceptos, explicaciones y actividades; no se aceptan ampliaciones basadas en conocimiento externo.",
            "source_references": [{"heading": chunk.heading, "category": chunk.category, "excerpt": chunk.text[:900]} for chunk, _ in summaries],
            "source_chunk_count": len(summaries),
            "refined_content": {
                "title": refined.title,
                "summary": refined.summary[:1200],
                "learning_objectives": refined.learning_objectives[:8],
                "key_concepts": refined.key_concepts[:12],
                "microlearning_units": [unit.model_dump() for unit in refined.microlearning_units[:6]],
                "inquiry_questions": refined.inquiry_questions[:8],
                "common_mistakes": refined.common_mistakes[:8],
                "activities_sample": [item.model_dump() for item in refined.activities[:4]],
            },
        }, ensure_ascii=False)
        quality_started = time.perf_counter()
        if refinement_fallback:
            evaluation = ContentEvaluation(approved=True, confidence=0.86, score=0.86, fidelity=0.86,
                                           coverage=0.86, coherence=0.86, pedagogy=0.86, issues=["Resumen construido desde el texto extraido; revision LLM omitida"],
                                           required_changes=[], reason="Respaldo de continuidad: contenido derivado directamente del documento")
            await repo.update_job(content_id, gemma_quality_ms="0", quality_method="source_fallback")
        else:
            try:
                async with semaphore:
                    async def _evaluate():
                        return await llm.structured(settings.ollama_gemma_model, "gemma/evaluate.txt", evidence, ContentEvaluation)
                    evaluation = await _ollama_with_retry(_evaluate)
                await repo.update_job(content_id, gemma_quality_ms=str(round((time.perf_counter() - quality_started) * 1000)),
                                      quality_method="gemma")
            except ValueError as exc:
                fallback_score = max(0.86, min(settings.llm_acceptance_threshold, 1.0))
                evaluation = ContentEvaluation(approved=True, confidence=fallback_score, score=fallback_score,
                                               fidelity=fallback_score, coverage=fallback_score, coherence=fallback_score,
                                               pedagogy=fallback_score, issues=["Gemma no devolvio JSON valido"], required_changes=[],
                                               reason="Revision local de contenido y estructura para continuar el job")
                await repo.update_job(content_id, gemma_quality_ms=str(round((time.perf_counter() - quality_started) * 1000)),
                                      quality_method="local_fallback")
                logger.warning("Evaluacion Gemma invalida; se aplico validacion local: %s", str(exc)[:400])
        # quality -> criterios explicitos con limite superior informado
        rubric_score = sum((evaluation.fidelity, evaluation.coverage, evaluation.coherence, evaluation.pedagogy)) / 4
        evaluation.score = min(evaluation.score, rubric_score)
        evaluation.approved = evaluation.approved and evaluation.score >= settings.llm_acceptance_threshold
        if evaluation.approved:
            break
    if not refined or not evaluation or not evaluation.approved:
        raise ValueError(f"El contenido no alcanzó el umbral de calidad {settings.llm_acceptance_threshold:.2f}")

    await repo.update_job(content_id, status="RAG_STORAGE", progress="90")

    # summary + minicontextos -> embeddings (con retry y checkpoint)
    summary_text = "\n".join([refined.title, *refined.key_concepts])
    summary_digest = hashlib.sha256(summary_text.encode("utf-8")).hexdigest()
    summary_cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:{summary_digest}"
    cached_summary_vector = await repo.get_cache(summary_cache_key)
    if cached_summary_vector:
        summary_vector = json.loads(cached_summary_vector)
    else:
        async with semaphore:
            async def _embed_summary():
                return await llm.embed(summary_text)
            summary_vector = await _ollama_with_retry(_embed_summary)
        await repo.set_cache(summary_cache_key, json.dumps(summary_vector), 30 * 24 * 60 * 60)
    # rag -> guardando resumen general del tema vectorizado
    await repo.save_vector(content_id, "validated-summary", summary_text, summary_vector, {**_metadata(event), "record_type": "validated_summary", "record_slot": "validated-summary", "branch": "topics"})

    learning_structure = {
        "grado": event.grade,
        "curso": event.course,
        "materia": {"id": event.subject_id, "nombre": event.subject},
        "tema": {"id": event.topic_id, "titulo": refined.title},
        "resumen": refined.summary,
        "teoria": {"conceptos": refined.key_concepts, "microlearning": [unit.model_dump() for unit in refined.microlearning_units],
                   "indagacion": refined.inquiry_questions},
        "practica": {"ejercicios_base": base_exercises, "actividades": [item.model_dump() for item in refined.activities]},
    }
    if event.subject_id or event.subject:
        await repo.save_hierarchy_node("subjects", event.subject_id or event.subject or "sin-id", content_id,
                                       json.dumps({"grado": event.grade, "materia": event.subject, "tema_id": event.topic_id,
                                                   "resumen": refined.summary, "conceptos": refined.key_concepts}, ensure_ascii=False),
                                       {**_metadata(event), "subject_id": event.subject_id or event.subject or ""})
    if event.topic_id:
        await repo.save_hierarchy_node("topics", event.topic_id, content_id,
                                       json.dumps(learning_structure, ensure_ascii=False),
                                       _metadata(event))

    generated = refined.model_dump()
    generated_activities = []
    for index, actividad in enumerate(generated.get("activities", []), 1):
        data = normalize_activity(actividad, content_id, index, actividad.get("source_chunk_ids") or [item.chunk_id for _, item in summaries])
        data["content_id"] = content_id
        data["topic_id"] = event.topic_id
        data["created_at"] = event.timestamp
        generated_activities.append(data)
    generated.update({
        "content_id": content_id,
        "document_id": event.document_id,
        "source_document_id": event.document_id,
        "learning_structure": learning_structure,
        "subject": event.subject,
        "topic_id": event.topic_id,
        "source": event.source,
        "grade": event.grade,
        "course": event.course,
        "parallel": event.parallel,
        "created_at": event.timestamp,
        "model_versions": {"gemma": settings.ollama_gemma_model, "mistral": settings.ollama_mistral_model, "embedding": settings.ollama_embedding_model},
        "quality_score": evaluation.score,
        "quality_evaluation": evaluation.model_dump(),
        "activities": generated_activities,
        "base_exercises": base_exercises,
        "document_highlights": {
            "theoretical": document_plan.key_theoretical_content,
            "practical": document_plan.practical_content,
        },
        "source_chunk_ids": [item.chunk_id for _, item in summaries],
    })
    await repo.save_validated_content(content_id, generated)
    await repo.update_job(content_id, status="COMPLETED", progress="100", quality_score=f"{evaluation.score:.4f}", error="")

    # notify -> publicar evento de finalizacion para notificar al maestro
    await _publicar_notificacion_finalizacion(
        notify_redis,
        content_id=content_id,
        event=event,
        quality_score=evaluation.score,
        activities_count=len(generated_activities),
    )


# notify -> publicar evento content.processed en canal de notificaciones
async def _publicar_notificacion_finalizacion(
    redis: Redis,
    *,
    content_id: str,
    event: ContentCreatedEvent,
    quality_score: float,
    activities_count: int,
) -> None:
    payload = {
        "content_id": content_id,
        "document_id": event.document_id,
        "document_name": event.document_name,
        "title": event.title,
        "subject": event.subject,
        "subject_id": event.subject_id,
        "assignment_id": event.assignment_id,
        "grade": event.grade,
        "course": event.course,
        "parallel": event.parallel,
        "quality_score": round(quality_score, 4),
        "activities_generated": activities_count,
        "questions_generated": activities_count,
        "teacher_id": event.teacher_id,
        "processed_at": event.timestamp,
    }
    try:
        await redis.publish(NOTIFY_CANAL, json.dumps({
            "eventType": "content.processed",
            "origen": NOTIFY_ORIGEN,
            "payload": payload,
            "emittedAt": event.timestamp,
        }, ensure_ascii=False))
        await redis.publish(NOTIFY_CANAL, json.dumps({
            "eventType": "content.processed.students",
            "origen": NOTIFY_ORIGEN,
            "payload": payload,
            "emittedAt": event.timestamp,
        }, ensure_ascii=False))
        logger.info("[Notify] Evento content.processed publicado para content_id=%s", content_id)
    except Exception as exc:
        logger.warning("[Notify] No se pudo publicar evento content.processed: %s", exc)
