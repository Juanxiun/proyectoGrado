import asyncio
import hashlib
import json
import logging
from typing import Any

import httpx

from app.config import settings
from app.chunking import split_chunks
from app.documents import extract_text
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ChunkSummary, ContentCreatedEvent, ContentEvaluation, RefinedContent

logger = logging.getLogger(__name__)


def _metadata(event: ContentCreatedEvent) -> dict[str, str]:
    return {key: str(value or "") for key, value in {
        "subject": event.subject, "subject_id": event.subject_id, "topic_id": event.topic_id,
        "document_id": event.document_id, "source": event.source, "grade": event.grade,
        "course": event.course, "parallel": event.parallel,
    }.items()}


async def process_content(content_id: str, raw_event: dict[str, Any], repo: RAGRepository, llm: OllamaClient, http: httpx.AsyncClient, semaphore: asyncio.Semaphore) -> None:
    event = ContentCreatedEvent.model_validate(raw_event)
    async with http.stream("GET", str(event.document_url), follow_redirects=True) as response:
        response.raise_for_status()
        data = bytearray()
        async for part in response.aiter_bytes():
            data.extend(part)
            if len(data) > settings.max_document_bytes:
                raise ValueError("El documento supera el límite de tamaño configurado")
    await repo.update_job(content_id, status="EXTRACTING", progress="5")
    source_text = extract_text(bytes(data), event.document_name)
    chunks = split_chunks(source_text, settings.chunk_size, settings.chunk_overlap, settings.max_chunks_per_document)
    await repo.update_job(content_id, status="GEMMA_ANALYSIS", progress="15", total_chunks=str(len(chunks)))

    async def summarize(index: int, text: str) -> tuple[str, ChunkSummary]:
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:20]
        chunk_id = f"{index:04d}-{digest}"
        cache_key = f"{repo.prefix}:cache:summary:{settings.ollama_gemma_model}:{digest}"
        cached = await repo.get_cache(cache_key)
        if cached:
            result = ChunkSummary.model_validate_json(cached)
            result.chunk_id = chunk_id
            return text, result
        async with semaphore:
            result = await llm.structured(settings.ollama_gemma_model, "gemma/summarize.txt", json.dumps({"chunk_id": chunk_id, "title": event.title, "text": text}, ensure_ascii=False), ChunkSummary)
        if result.chunk_id != chunk_id:
            result.chunk_id = chunk_id
        await repo.set_cache(cache_key, result.model_dump_json(), 30 * 24 * 60 * 60)
        return text, result

    summaries = await asyncio.gather(*(summarize(index, text) for index, text in enumerate(chunks, 1)))
    compact = json.dumps({"title": event.title, "description": event.description, "subject": event.subject, "grade": event.grade, "chunks": [item.model_dump() for _, item in summaries]}, ensure_ascii=False)
    await repo.update_job(content_id, status="MISTRAL_REFINEMENT", progress="50")
    refined: RefinedContent | None = None
    evaluation: ContentEvaluation | None = None
    corrections = ""
    for iteration in range(settings.llm_max_refinement_iterations):
        async with semaphore:
            refined = await llm.structured(settings.ollama_mistral_model, "mistral/refine.txt", compact + corrections, RefinedContent)
        await repo.update_job(content_id, status="QUALITY_EVALUATION", progress=str(65 + iteration * 8), refinement_iteration=str(iteration + 1))
        evidence = json.dumps({
            "source_excerpt": source_text[: min(len(source_text), 14000)],
            "chunk_summaries": [item.model_dump() for _, item in summaries],
            "refined_content": refined.model_dump(),
        }, ensure_ascii=False)
        async with semaphore:
            evaluation = await llm.structured(settings.ollama_gemma_model, "gemma/evaluate.txt", evidence, ContentEvaluation)
        # Se calcula con criterios explícitos y se conserva el límite superior informado por el evaluador.
        rubric_score = sum((evaluation.fidelity, evaluation.coverage, evaluation.coherence, evaluation.pedagogy)) / 4
        evaluation.score = min(evaluation.score, rubric_score)
        evaluation.approved = evaluation.approved and evaluation.score >= settings.llm_acceptance_threshold
        if evaluation.approved:
            break
        corrections = "\n\nMejorar el borrador anterior según estos problemas sin agregar datos externos: " + "; ".join(evaluation.required_changes or evaluation.issues)
    if not refined or not evaluation or not evaluation.approved:
        raise ValueError(f"El contenido no alcanzó el umbral de calidad {settings.llm_acceptance_threshold:.2f}")

    await repo.update_job(content_id, status="RAG_STORAGE", progress="90")
    metadata = {**_metadata(event), "record_type": "source_chunk", "branch": "knowledge"}
    for source_chunk, summary in summaries:
        digest = hashlib.sha256(source_chunk.encode("utf-8")).hexdigest()
        cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:{digest}"
        cached_vector = await repo.get_cache(cache_key)
        if cached_vector:
            vector = json.loads(cached_vector)
        else:
            async with semaphore:
                vector = await llm.embed(source_chunk)
            await repo.set_cache(cache_key, json.dumps(vector), 30 * 24 * 60 * 60)
        await repo.save_vector(content_id, summary.chunk_id, source_chunk, vector, metadata)

    summary_text = "\n".join([refined.title, refined.summary, *refined.key_concepts, *refined.learning_objectives])
    summary_digest = hashlib.sha256(summary_text.encode("utf-8")).hexdigest()
    summary_cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:{summary_digest}"
    cached_summary_vector = await repo.get_cache(summary_cache_key)
    if cached_summary_vector:
        summary_vector = json.loads(cached_summary_vector)
    else:
        async with semaphore:
            summary_vector = await llm.embed(summary_text)
        await repo.set_cache(summary_cache_key, json.dumps(summary_vector), 30 * 24 * 60 * 60)
    await repo.save_vector(content_id, "validated-summary", summary_text, summary_vector, {**metadata, "record_type": "validated_summary", "branch": "topics"})

    # Mini-contextos por materia y tema: solo derivan del material docente aprobado.
    mini_context = json.dumps({
        "materia": event.subject, "materia_id": event.subject_id,
        "tema_id": event.topic_id, "titulo": refined.title,
        "contexto": refined.summary, "conceptos": refined.key_concepts,
        "objetivos": refined.learning_objectives, "grado": event.grade,
    }, ensure_ascii=False)
    if event.subject_id or event.subject:
        subject_context = f"Materia: {event.subject or event.subject_id}. Contexto validado: {refined.summary}. Conceptos: {'; '.join(refined.key_concepts)}. Objetivos: {'; '.join(refined.learning_objectives)}"
        async with semaphore:
            subject_vector = await llm.embed(subject_context)
        await repo.save_branch_context("subjects", event.subject_id or event.subject or "sin-id", content_id,
                                       subject_context, subject_vector, {**metadata, "subject_id": event.subject_id or event.subject or ""})
    if event.topic_id:
        async with semaphore:
            topic_vector = await llm.embed(mini_context)
        await repo.save_branch_context("topics", event.topic_id, content_id, mini_context, topic_vector, metadata)

    generated = refined.model_dump()
    for index, question in enumerate(generated.get("questions", []), 1):
        question["question_id"] = hashlib.sha256(f"{content_id}:{index}:{question['question']}".encode("utf-8")).hexdigest()
        question["content_id"] = content_id
        question["topic_id"] = event.topic_id
        question["created_at"] = event.timestamp
    generated.update({
        "content_id": content_id,
        "document_id": event.document_id,
        "source_document_id": event.document_id,
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
        "source_chunk_ids": [item.chunk_id for _, item in summaries],
    })
    await repo.save_validated_content(content_id, generated)
    await repo.update_job(content_id, status="COMPLETED", progress="100", quality_score=f"{evaluation.score:.4f}", error="")
