import asyncio
import json
import logging

from app.config import settings
from app.ollama_client import OllamaClient
from app.RAG.repository import RAGRepository
from app.pipeline import _svg_pedagogico_nativo
from app.schemas import ExplainSectionRequest, PersonalizedLearningContent, PersonalizedLearningDraft, StudentLearningAnalysis, StudentLearningOverview

logger = logging.getLogger(__name__)
DIFFICULTIES = ["inicial", "intermedia", "avanzada"]


async def explain_section(student_id: str, content_id: str, request: ExplainSectionRequest, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("No existe contenido aprobado para explicar")
    profile = await repo.get_student_profile(student_id, content_id)
    evidence = json.dumps({
        "titulo_carta": request.title,
        "contexto_estricto": request.explanation[:900],
        "ejemplo_referencia": (request.example or "")[:500],
        "formato_solicitado": request.format,
        "materia": content.get("subject") or "",
        "resumen_tema": str(content.get("summary") or "")[:280],
    }, ensure_ascii=False)
    try:
        async with asyncio.timeout(50):
            async with semaphore:
                generated = await llm.structured(
                    settings.ollama_gemma_model,
                    "gemma/explain_section.txt",
                    evidence,
                    PersonalizedLearningDraft,
                )
    except TimeoutError:
        raise RuntimeError("La explicación tardó demasiado. Inténtalo de nuevo en unos segundos.")
    data = generated.model_dump()
    ejemplos = data.get("examples") or ([request.example] if request.example else [])
    data["explanation_svg"] = _svg_pedagogico_nativo(request.title, ejemplos, data.get("explanation") or request.explanation)
    return {**data, "title": request.title, "format": request.format, "profile_available": bool(profile), "content_id": content_id}


# feedback -> solo fallidas microlearning + pizarra
async def generate_remediation_failed_only(answers: list[dict], content: dict, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    incorrect = [a for a in answers if not a.get("correct", True)]
    if not incorrect:
        return {"remediation": [], "message": "¡Todas las respuestas son correctas!"}
    
    remediation_list = []
    for answer in incorrect:
        concept = answer.get("concept", "Concepto evaluado")
        feedback = answer.get("feedback", {})
        explanation = feedback.get("explanation", "")
        correct_answer = feedback.get("correct_answer", "")
        
        request = ExplainSectionRequest(
            title=f"Repaso: {concept}",
            explanation=explanation or f"Revisa el concepto: {concept}",
            example=correct_answer,
            format="paso_a_paso",
        )
        try:
            explained = await explain_section(answer.get("student_id", ""), content.get("content_id", ""), request, repo, llm, semaphore)
            microlearning = explained.get("microlearning_units", [])
            examples = explained.get("examples", [])
            remediation_list.append({
                "activity_id": answer.get("activity_id"),
                "concept": concept,
                "microlearning": microlearning[:1] if microlearning else [{"title": concept, "explanation": explanation, "objective": f"Comprender {concept}", "inquiry_question": f"¿Cómo se aplica {concept}?"}],
                "blackboard_example": examples[0] if examples else f"Ejemplo guiado para {concept}: {correct_answer}",
            })
        except Exception as exc:
            logger.warning("Error generando remediación para %s: %s", concept, exc)
            remediation_list.append({
                "activity_id": answer.get("activity_id"),
                "concept": concept,
                "microlearning": [{"title": concept, "explanation": explanation, "objective": f"Comprender {concept}", "inquiry_question": f"¿Cómo se aplica {concept}?"}],
                "blackboard_example": f"Ejemplo: {correct_answer}",
            })
    
    return {"remediation": remediation_list, "total_failed": len(incorrect)}


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
    attempt_count, performance_score, average_elapsed_ms = await repo.profile_attempt_summary(student_id, content_id)
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
        "average_response_time_ms": round(average_elapsed_ms),
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
        "average_response_time_ms": round(average_elapsed_ms),
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
    overview = await repo.get_student_learning_overview(student_id)
    if not profile and not overview:
        raise LookupError("Completa actividades o resúmenes para crear tu perfil de aprendizaje")
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("No existe contenido aprobado para personalizar")
    cached = await repo.personalize_cache_get(student_id, content_id)
    profile_batch_number = profile.get("batch_number") if profile else None
    overview_updated_at = overview.get("updated_at") if overview else None
    if cached and cached.get("profile_batch_number") == profile_batch_number and cached.get("overview_updated_at") == overview_updated_at:
        return cached

    query_text = " ".join([str(content.get("title", "")), *(profile or {}).get("weaknesses", []), *content.get("key_concepts", [])])
    async with semaphore:
        query_vector = await llm.embed(query_text)
    scope = {"content_id": content_id, "record_type": "theory_context"}
    # rag -> recuperar solo conceptos del contenido
    evidence_chunks = await repo.vector_search(
        query_vector,
        limit=8,
        filters=scope,
    )
    evidence = json.dumps({
        "teacher_validated_content": {
            "title": content.get("title"),
            "summary": content.get("summary"),
            "objectives": content.get("learning_objectives", []),
            "concepts": content.get("key_concepts", []),
        },
        "retrieved_teacher_source_chunks": evidence_chunks,
        "student_learning_profile": profile or {},
        "overall_learning_overview": overview,
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
        "profile_batch_number": profile_batch_number,
        "overview_updated_at": overview_updated_at,
        "difficulty_level": (profile or {}).get("difficulty_level", "inicial"),
        "created_at": repo.now(),
    }
    await repo.personalize_cache_set(student_id, content_id, result)
    return result


async def evaluate_student_learning_overview(student_id: str, evidence: dict, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    activities = evidence.get("actividades", []) if isinstance(evidence, dict) else []
    events = evidence.get("eventosEstudio", []) if isinstance(evidence, dict) else []
    activities = [item for item in activities if isinstance(item, dict)][:120]
    events = [item for item in events if isinstance(item, dict)][:300]
    all_topics = evidence.get("temasIndagados", []) if isinstance(evidence, dict) else []
    inquiry_topics = sorted({str(topic).strip() for topic in all_topics if str(topic).strip()})
    if not inquiry_topics:
        inquiry_topics = sorted({str(item.get("tema", "")).strip() for item in events if item.get("tipo") == "investigacion" and str(item.get("tema", "")).strip()})
    inquiry_count = int(evidence.get("temasIndagadosCount", len(inquiry_topics))) if isinstance(evidence, dict) else len(inquiry_topics)
    source = json.dumps({
        "activities": activities,
        "study_events": events,
        "counts": {
            "activity_count": len(activities),
            "distinct_investigated_topics": inquiry_count,
            "investigated_topics": inquiry_topics[:30],
            "completed_summaries": int(evidence.get("resumenesCompletados", sum(1 for item in events if item.get("tipo") == "resumen_completado"))),
        },
        "previous_overview": await repo.get_student_learning_overview(student_id),
    }, ensure_ascii=False)
    async with asyncio.timeout(60):
        async with semaphore:
            analysis = await llm.structured(
                settings.ollama_mistral_model,
                "mistral/learning_overview.txt",
                source,
                StudentLearningOverview,
            )
    result = {
        **analysis.model_dump(),
        "investigated_topics_count": inquiry_count,
        "deep_inquiry_topics": inquiry_topics[:10],
        "evidence_activity_count": len(activities),
        "completed_summaries": int(evidence.get("resumenesCompletados", sum(1 for item in events if item.get("tipo") == "resumen_completado"))),
        "updated_at": repo.now(),
        "model": settings.ollama_mistral_model,
    }
    await repo.save_student_learning_overview(student_id, result)
    return result
