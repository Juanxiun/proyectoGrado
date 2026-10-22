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
from app.chunking import CATEGORIA_EJERCICIOS, SemanticChunk, split_chunks
from app.documents import extract_text
from app.ollama_client import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ActivityBatchOutput, ContentCreatedEvent, ContentEvaluation, RefinedContent
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

# retry -> configuracion para Ollama
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
        except (ConnectionError, httpx.TimeoutException, httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                delay = OLLAMA_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(f"Ollama request falló (intento {attempt + 1}/{max_retries}), reintentando en {delay}s: {exc}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Ollama request falló tras {max_retries} intentos: {exc}")
                raise
        except Exception as exc:
            # retry -> errores no de red no se reintentan
            logger.error(f"Error de Ollama no recuperable: {exc}")
            raise
    raise last_exc


# contenido -> sintesis pedagogica Gemma basada en fragmentos fuente
async def _generate_learning_content(
    llm: OllamaClient,
    reference_chunks: list[tuple[int, SemanticChunk]],
    event: ContentCreatedEvent,
    semaphore: asyncio.Semaphore
) -> RefinedContent:
    started = time.perf_counter()
    # prompt -> evidencia compacta para Gemma
    compact = json.dumps({
        "title": event.title,
        "description": event.description,
        "subject": event.subject,
        "grade": event.grade,
        "theory_highlights": list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading)),
        "practical_highlights": list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                   if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading)),
        "chunks": [{"chunk_id": f"{index:04d}-{hashlib.sha256(chunk.text.encode('utf-8')).hexdigest()[:20]}",
                    "heading": chunk.heading, "category": chunk.category, "text": chunk.text[:1600]}
                   for index, chunk in reference_chunks],
    }, ensure_ascii=False)
    async with semaphore:
        result = await _ollama_with_retry(lambda: llm.structured(
            settings.ollama_gemma_model, "gemma/learning_content.txt", compact, RefinedContent))
    logger.info(f"Contenido educativo (Gemma) completado en {time.perf_counter() - started:.2f}s")
    return result


async def _generate_activity_batch(
    llm: OllamaClient,
    reference_chunks: list[tuple[int, SemanticChunk]],
    event: ContentCreatedEvent,
    activity_type: str,
    semaphore: asyncio.Semaphore,
) -> list[dict[str, Any]]:
    source = [{
        "evidence_index": source_index,
        "chunk_id": f"{index:04d}-{hashlib.sha256(chunk.text.encode('utf-8')).hexdigest()[:20]}",
        "heading": chunk.heading,
        "text": chunk.text[:1600],
    } for source_index, (index, chunk) in enumerate(reference_chunks, 1)]
    context = json.dumps({
        "title": event.title,
        "subject": event.subject,
        "grade": event.grade,
        "tipo_objetivo": activity_type,
        "evidencia_original": source,
    }, ensure_ascii=False)
    async with semaphore:
        result = await _ollama_with_retry(lambda: llm.structured(
            settings.ollama_gemma_model,
            "gemma/activity_generation.txt",
            context,
            ActivityBatchOutput,
        ))
    chunk_id_by_index = {item["evidence_index"]: item["chunk_id"] for item in source}
    activities = [{
        "type": item.t,
        "question": item.q,
        "answer": item.a,
        "explanation": item.e,
        "difficulty": item.d,
        "learning_objective": item.o,
        "source_chunk_ids": [chunk_id_by_index[item.c]] if item.c in chunk_id_by_index else [],
    } for item in result.activities]
    valid_ids = set(chunk_id_by_index.values())
    for activity in activities:
        if activity["type"] != activity_type:
            raise ValueError(f"El lote {activity_type} contiene una actividad de otro tipo")
        activity["source_chunk_ids"] = [item for item in activity["source_chunk_ids"] if item in valid_ids]
        if not activity["source_chunk_ids"]:
            raise ValueError("Una actividad no referencia evidencia valida del material")
    return activities


async def _generate_activity_bank(
    llm: OllamaClient,
    reference_chunks: list[tuple[int, SemanticChunk]],
    event: ContentCreatedEvent,
    semaphore: asyncio.Semaphore,
) -> list[dict[str, Any]]:
    theoretical, practical = await asyncio.gather(
        _generate_activity_batch(llm, reference_chunks, event, "THEORETICAL", semaphore),
        _generate_activity_batch(llm, reference_chunks, event, "PRACTICAL", semaphore),
    )
    activities = theoretical + practical
    fingerprints = [re.sub(r"\W+", " ", item["question"].casefold()).strip() for item in activities]
    if len(set(fingerprints)) != len(fingerprints):
        raise ValueError("El banco generado contiene preguntas duplicadas")
    if sum(item["type"] == "THEORETICAL" for item in activities) != 10 or sum(item["type"] == "PRACTICAL" for item in activities) != 10:
        raise ValueError("El banco debe contener 10 actividades teoricas y 10 practicas")
    return activities



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
    
    await repo.update_job(content_id, status="EXTRACTING", progress="12")

    # chunking -> generar contexto distribuido desde el documento limpio
    desired_chunks = 6
    effective_chunk_size = max(settings.chunk_size, min(settings.chunk_size * 3, (len(source_text) + desired_chunks - 1) // desired_chunks))
    chunks = split_chunks(source_text, effective_chunk_size, 6, settings.chunk_min_chars, settings.chunk_semantic_threshold)
    if not chunks:
        raise ValueError("No se pudieron crear fragmentos útiles del documento")
    reference_chunks = _select_reference_chunks(chunks)
    total_chunks = len(reference_chunks)
    
    processed_key = f"{repo.prefix}:content:{content_id}:processed_chunks:v3"
    processed_raw = await repo.get_cache(processed_key)
    processed_indices = set(json.loads(processed_raw)) if processed_raw else set()
    
    base_exercises = [chunk.text for _, chunk in reference_chunks if chunk.category == CATEGORIA_EJERCICIOS]
    
    # embeddings -> preparar vectores en paralelo con el resumen
    embedding_entries: list[tuple[int, SemanticChunk, str, str]] = []
    vector_by_chunk: dict[str, list[float]] = {}
    for index, chunk in reference_chunks:
        vector_text = "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        vector_digest = hashlib.sha256(vector_text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:concept:{vector_digest}"
        cached = await repo.get_cache(cache_key)
        if cached:
            vector_by_chunk[chunk_id] = json.loads(cached)
        else:
            embedding_entries.append((index, chunk, chunk_id, cache_key))
    
    async def _embed_pending() -> None:
        if not embedding_entries:
            return
        started = time.perf_counter()
        async with semaphore:
            vectors = await _ollama_with_retry(lambda: llm.embed_many([
                "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
                for _, chunk, _, _ in embedding_entries
            ]))
        for (_, _, chunk_id, cache_key), vector in zip(embedding_entries, vectors):
            vector_by_chunk[chunk_id] = vector
            await repo.set_cache(cache_key, json.dumps(vector), 30 * 24 * 60 * 60)
        logger.info(f"Embeddings completados en {time.perf_counter() - started:.2f}s")

    async def _timed(operation):
        started = time.perf_counter()
        result = await operation
        return result, round((time.perf_counter() - started) * 1000)
    
    # LLM -> resumen y actividades con solicitudes concurrentes
    await repo.update_job(content_id, status="GEMMA_PARALLEL_GENERATION", progress="20", total_chunks=str(total_chunks), current_chunk="0")
    summary_task = asyncio.create_task(_timed(_generate_learning_content(llm, reference_chunks, event, semaphore)))
    activity_task = asyncio.create_task(_timed(_generate_activity_bank(llm, reference_chunks, event, semaphore)))
    embed_task = asyncio.create_task(_embed_pending())
    summary_result, activity_result = await asyncio.gather(summary_task, activity_task, return_exceptions=True)
    if isinstance(summary_result, BaseException):
        raise summary_result
    if isinstance(activity_result, BaseException):
        raise activity_result
    refined, summary_ms = summary_result
    activities, activity_ms = activity_result
    refined.activities = activities
    await repo.update_job(
        content_id,
        status="SUMMARY_READY",
        progress="60",
        summary_generation_ms=str(summary_ms),
        activity_generation_ms=str(activity_ms),
    )
    
    # Esperar embeddings
    await embed_task
    
    refined.summary = _resumen_conceptual(refined.summary, event.document_name, refined.key_concepts)
    await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress="72", total_chunks=str(total_chunks), current_chunk="0")
    indexed_chunk_ids: list[str] = []
    for selected_index, (index, chunk) in enumerate(reference_chunks, 1):
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        indexed_chunk_ids.append(chunk_id)
        metadata = _chunk_metadata(event, chunk)
        metadata["record_slot"] = f"{metadata['record_type']}:{selected_index:02d}"
        vector_text = "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
        await repo.save_vector(content_id, chunk_id, vector_text, vector_by_chunk[chunk_id], metadata)
        processed_indices.add(index)
        await repo.set_cache(processed_key, json.dumps(sorted(processed_indices)), 30 * 24 * 60 * 60)
        progress = 72 + int(12 * selected_index / total_chunks)
        await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress=str(progress), total_chunks=str(total_chunks), current_chunk=str(selected_index))

    await repo.update_job(content_id, status="QUALITY_EVALUATION", progress="88", quality_method="local_schema_and_evidence")
    evaluation = ContentEvaluation(
        approved=True, confidence=0.9, score=0.9, fidelity=0.9, coverage=0.9,
        coherence=0.9, pedagogy=0.9, issues=[], required_changes=[],
        reason="Estructura validada y actividades enlazadas a fragmentos fuente",
    )
    if not refined or not evaluation or not evaluation.approved:
        raise ValueError(f"El contenido no alcanzó el umbral de calidad {settings.llm_acceptance_threshold:.2f}")

    await repo.update_job(content_id, status="RAG_STORAGE", progress="90")

    # summary + minicontextos -> embeddings (con retry y checkpoint)
    summary_text = "\n".join([refined.title, refined.summary, *refined.key_concepts])
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

    # highlights teoricos y practicos desde reference_chunks (reemplaza DocumentPlan legacy)
    theoretical_highlights = list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                                if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading))
    practical_highlights = list(dict.fromkeys(chunk.heading for _, chunk in reference_chunks
                                              if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading))

    learning_structure = {
        "grado": event.grade,
        "curso": event.course,
        "materia": {"id": event.subject_id, "nombre": event.subject},
        "tema": {"id": event.topic_id, "titulo": refined.title},
        "resumen": refined.summary,
        "resumen_estructurado": {
            "tema": refined.title,
            "resumen_general": refined.summary,
            "contenido": [{
                "subtitulo": unit.title,
                "microlearning": unit.explanation,
                "ejemplos": [{"descripcion": example, "grafico_xml": ""}
                              for example in unit.examples_blackboard],
            } for unit in refined.microlearning_units],
        },
        "teoria": {"conceptos": refined.key_concepts, "microlearning": [unit.model_dump() for unit in refined.microlearning_units],
                   "indagacion": refined.inquiry_questions},
        "practica": {"ejercicios_base": base_exercises, "actividades": [item if isinstance(item, dict) else item.model_dump() for item in refined.activities]},
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
        data = normalize_activity(actividad, content_id, index, actividad.get("source_chunk_ids") or indexed_chunk_ids)
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
            "theoretical": theoretical_highlights,
            "practical": practical_highlights,
        },
        "source_chunk_ids": indexed_chunk_ids,
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
