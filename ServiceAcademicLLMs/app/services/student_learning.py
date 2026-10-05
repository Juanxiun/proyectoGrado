import json
import logging

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import PersonalizedLearningContent, StudentLearningAnalysis

logger = logging.getLogger(__name__)
DIFFICULTIES = ["inicial", "intermedia", "avanzada"]


def recommended_difficulty(last_batch_average: float, previous: str | None) -> str:
    current = previous if previous in DIFFICULTIES else DIFFICULTIES[0]
    index = DIFFICULTIES.index(current)
    if last_batch_average >= settings.quiz_advance_threshold:
        return DIFFICULTIES[min(index + 1, len(DIFFICULTIES) - 1)]
    if last_batch_average < settings.quiz_retain_threshold:
        return DIFFICULTIES[max(index - 1, 0)]
    return current


async def update_student_profile(
    student_id: str,
    content_id: str,
    batch_number: int,
    repo: RAGRepository,
    llm: OllamaClient,
    semaphore,
) -> None:
    attempts = await repo.profile_attempt_batch(student_id, content_id, batch_number)
    if len(attempts) != 4:
        raise ValueError("El lote de actualizacion debe incluir exactamente cuatro cuestionarios")
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("No existe contenido validado para evaluar el perfil")
    previous = await repo.get_student_profile(student_id, content_id)
    attempt_count, performance_score = await repo.profile_attempt_summary(student_id, content_id)
    last_batch_average = sum(float(attempt["score"]) for attempt in attempts) / 4
    prior_difficulty = previous.get("difficulty_level") if previous else "inicial"
    suggested_difficulty = recommended_difficulty(last_batch_average, prior_difficulty)
    evidence = json.dumps({
        "validated_learning_content": {
            "title": content.get("title"),
            "summary": content.get("summary"),
            "objectives": content.get("learning_objectives", []),
            "concepts": content.get("key_concepts", []),
        },
        "previous_profile": previous,
        "four_completed_quizzes": attempts,
        "batch_average_score": last_batch_average,
        "cumulative_attempt_count": attempt_count,
        "cumulative_performance_score": performance_score,
        "rule_based_difficulty_recommendation": suggested_difficulty,
    }, ensure_ascii=False)
    async with semaphore:
        analysis = await llm.structured(
            settings.ollama_mistral_model,
            "mistral/evaluate_student.txt",
            evidence,
            StudentLearningAnalysis,
        )
    profile = {
        "student_id": student_id,
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "subject_id": content.get("subject_id"),
        "topic_id": content.get("topic_id"),
        "grado": content.get("grade"),
        "curso": content.get("course"),
        "paralelo": content.get("parallel"),
        **analysis.model_dump(),
        "difficulty_level": suggested_difficulty,
        "performance_score": round(performance_score, 4),
        "attempts": attempt_count,
        "updated_at": repo.now(),
        "batch_number": batch_number,
        "last_batch_score": round(last_batch_average, 4),
        "model": settings.ollama_mistral_model,
    }
    await repo.save_student_profile(student_id, content_id, profile)
    profile_text = "\n".join([
        str(profile.get("learning_profile", "")),
        "Fortalezas: " + "; ".join(profile["strengths"]),
        "Conceptos por reforzar: " + "; ".join(profile["weaknesses"]),
        "Estilo sugerido: " + profile["recommended_explanation_style"],
        "Dificultad recomendada: " + profile["difficulty_level"],
    ])
    async with semaphore:
        vector = await llm.embed(profile_text)
    await repo.save_vector(
        content_id=content_id,
        chunk_id=f"student-profile-{student_id}-batch-{batch_number}",
        text=profile_text,
        embedding=vector,
        metadata={
            "record_type": "student_profile",
            "branch": "students",
            "student_id": student_id,
            "subject_id": str(content.get("subject_id") or ""),
            "topic_id": str(content.get("topic_id") or ""),
            "source": "completed_quiz_analysis",
        },
    )
    logger.info("Perfil pedagógico actualizado student_id=%s content_id=%s batch=%s", student_id, content_id, batch_number)


async def create_personalized_content(student_id: str, content_id: str, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    profile = await repo.get_student_profile(student_id, content_id)
    if not profile:
        raise LookupError("El perfil se crea al completar cuatro cuestionarios de este contenido")
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("No existe contenido aprobado para personalizar")
    cached = await repo.personalize_cache_get(student_id, content_id)
    if cached and cached.get("profile_batch_number") == profile.get("batch_number"):
        return cached

    query_text = " ".join([str(content.get("title", "")), *profile.get("weaknesses", []), *content.get("key_concepts", [])])
    async with semaphore:
        query_vector = await llm.embed(query_text)
    evidence_chunks = await repo.vector_search(
        query_vector,
        limit=8,
        filters={"content_id": content_id, "record_type": "source_chunk"},
    )
    evidence = json.dumps({
        "teacher_validated_content": {
            "title": content.get("title"),
            "summary": content.get("summary"),
            "objectives": content.get("learning_objectives", []),
            "concepts": content.get("key_concepts", []),
        },
        "retrieved_teacher_source_chunks": evidence_chunks,
        "student_learning_profile": profile,
    }, ensure_ascii=False)
    async with semaphore:
        generated = await llm.structured(
            settings.ollama_mistral_model,
            "mistral/personalize_content.txt",
            evidence,
            PersonalizedLearningContent,
        )
    result = {
        **generated.model_dump(),
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "source_chunk_ids": [item.get("chunk_id") for item in evidence_chunks],
        "profile_batch_number": profile.get("batch_number"),
        "difficulty_level": profile.get("difficulty_level"),
        "created_at": repo.now(),
    }
    await repo.personalize_cache_set(student_id, content_id, result)
    return result
