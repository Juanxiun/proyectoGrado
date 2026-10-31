import asyncio
from collections import Counter
import hashlib
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
    progress = evidence.get("progresosTemas", []) if isinstance(evidence, dict) else []
    summary_count = int(evidence.get("resumenesCompletados", 0) or 0) if isinstance(evidence, dict) else 0
    total_activity_count = int(evidence.get("totalActividades", len(activities)) or 0) if isinstance(evidence, dict) else 0
    if summary_count < 1 or total_activity_count < 1:
        return {
            "ready": False,
            "message": "Completa al menos un resumen y una actividad para ver cómo vas.",
            "learning_rhythm": "",
            "strengths": [],
            "learning_orientation": "evidencia_insuficiente",
            "preferred_formats": [],
            "investigated_topics_count": 0,
            "investigations_count": 0,
            "deep_inquiry_topics": [],
            "possible_ambitions": [],
            "personalization_recommendation": "",
            "confidence": "baja",
            "evidence_activity_count": total_activity_count,
            "completed_summaries": summary_count,
            "completed_topics": 0,
        }
    activities = [item for item in activities if isinstance(item, dict)][:500]
    events = [item for item in events if isinstance(item, dict)][:300]
    progress = [item for item in progress if isinstance(item, dict)][:100]
    all_topics = evidence.get("temasIndagados", []) if isinstance(evidence, dict) else []
    inquiry_topics = sorted({str(topic).strip() for topic in all_topics if str(topic).strip()})
    if not inquiry_topics:
        inquiry_topics = sorted({str(item.get("tema", "")).strip() for item in events if item.get("tipo") == "investigacion" and str(item.get("tema", "")).strip()})
    inquiry_count = int(evidence.get("temasIndagadosCount", len(inquiry_topics))) if isinstance(evidence, dict) else len(inquiry_topics)
    topic_ids = list(dict.fromkeys(str(item.get("temaRutaId", "")) for item in events if item.get("tipo") == "tema_completado" and item.get("temaRutaId")))[:3]
    completed_topic_count = len({
        str(item.get("temaRutaId") or f"{item.get('materialId', '')}:{item.get('numeroTema', '')}")
        for item in events if item.get("tipo") == "tema_completado"
    })
    recent_topic_sessions = []
    for topic_id in topic_ids:
        recent_topic_sessions.extend(await repo.recent_topic_study_events(student_id, topic_id))
    attempts_by_topic: dict[str, list[dict]] = {}
    attempts_without_topic: list[dict] = []
    for activity in activities:
        topic_id = str(activity.get("temaRutaId") or "")
        if topic_id:
            attempts_by_topic.setdefault(topic_id, []).append(activity)
        else:
            attempts_without_topic.append(activity)
    included_attempts = [
        activity
        for topic_id in list(dict.fromkeys([*topic_ids, *attempts_by_topic.keys()]))[:3]
        for activity in attempts_by_topic.get(topic_id, [])[:5]
    ]
    included_attempts.extend(attempts_without_topic[:5])
    compact_activities = []
    for activity in included_attempts:
        questions = activity.get("preguntas") if isinstance(activity.get("preguntas"), list) else []
        answers = activity.get("respuestas") if isinstance(activity.get("respuestas"), list) else []
        question_text = {str(item.get("id", "")): str(item.get("texto", ""))[:120] for item in questions if isinstance(item, dict)}
        errores = [answer for answer in answers if isinstance(answer, dict) and not answer.get("correcta")][:3]
        compact_activities.append({
            "topic": str(activity.get("tituloTema") or activity.get("titulo") or "")[:120],
            "topic_id": activity.get("temaRutaId"),
            "score_percent": round(float(activity.get("porcentaje", 0) or 0) * 100),
            "elapsed_ms": int(activity.get("duracionMs", 0) or 0),
            "questions": int(activity.get("preguntasTotal", 0) or 0),
            "average_per_question_ms": int(activity.get("tiempoPorPreguntaMs", 0) or 0),
            "date": activity.get("fecha"),
            "incorrect_answers": [{
                "question": question_text.get(str(answer.get("preguntaId", "")), "")[:80],
                "response": str(answer.get("respuesta", ""))[:80],
                "feedback_on_error": str(answer.get("feedback", ""))[:180],
            } for answer in errores],
        })
    compact_events = [{
        "type": item.get("tipo"),
        "topic": str(item.get("tituloTema") or item.get("tema") or "")[:120],
        "topic_id": item.get("temaRutaId"),
        "inquiry": str(item.get("preguntaIndagacion") or "")[:120],
        "date": item.get("fecha"),
        "repeat": item.get("vecesRepetido"),
        "reading_ms": item.get("tiempoLecturaMs"),
        "explained_sections": [str(section)[:100] for section in item.get("partesExplicadas", [])[:3]],
    } for item in events if isinstance(item, dict) and item.get("tipo") in {"tema_completado", "investigacion", "resumen_completado"}][:15]
    compact_sessions = [{
        "topic": str(item.get("topic_title", ""))[:120],
        "topic_id": item.get("topic_id"),
        "reading_ms": int(item.get("reading_time_ms", 0) or 0),
        "cards": f"{item.get('cards_completed', 0)}/{item.get('total_cards', 0)}",
        "explained_sections": [str(section)[:100] for section in item.get("explained_sections", [])[:3]],
    } for item in recent_topic_sessions if isinstance(item, dict)][:15]
    activity_scores = [float(item.get("porcentaje", 0) or 0) for item in activities if item.get("porcentaje") is not None]
    activity_times = [int(item.get("duracionMs", 0) or 0) for item in activities if int(item.get("duracionMs", 0) or 0) > 0]
    total_questions = sum(int(item.get("preguntasTotal", 0) or 0) for item in activities)
    section_requests: Counter[tuple[str, str]] = Counter()
    for event in events:
        if event.get("tipo") not in {"tema_completado", "resumen_completado"}:
            continue
        topic_title = str(event.get("tituloTema") or event.get("tema") or "Tema")[:100]
        for section in event.get("partesExplicadas", []) if isinstance(event.get("partesExplicadas"), list) else []:
            if str(section).strip():
                section_requests[(topic_title, str(section).strip()[:100])] += 1
    attempts_by_topic_sorted = {
        topic_id: sorted(items, key=lambda item: str(item.get("fecha") or ""))
        for topic_id, items in attempts_by_topic.items()
    }
    topic_comparisons = []
    for topic_id, items in attempts_by_topic_sorted.items():
        if not items:
            continue
        first = items[0]
        latest = items[-1]
        first_score = round(float(first.get("porcentaje", 0) or 0) * 100)
        latest_score = round(float(latest.get("porcentaje", 0) or 0) * 100)
        topic_comparisons.append({
            "topic": str(latest.get("tituloTema") or latest.get("titulo") or "")[:100],
            "attempts": len(items),
            "average_score_percent": round(sum(float(item.get("porcentaje", 0) or 0) for item in items) / len(items) * 100),
            "average_exercise_time_ms": round(sum(int(item.get("duracionMs", 0) or 0) for item in items) / len(items)),
            "average_per_question_ms": round(sum(int(item.get("duracionMs", 0) or 0) for item in items) / max(1, sum(int(item.get("preguntasTotal", 0) or 0) for item in items))),
            "first_score_percent": first_score,
            "latest_score_percent": latest_score,
            "change_after_retries_percent": latest_score - first_score,
        })
    investigation_count = int(evidence.get("totalInvestigaciones", sum(1 for item in events if item.get("tipo") == "investigacion")) or 0)
    current_evidence = {
        "activities": compact_activities,
        "study_events": compact_events,
        "in_progress_topics": [{"topic": str(item.get("tituloTema", ""))[:100], "card": item.get("cartaActual"), "total_cards": item.get("totalCartas")} for item in progress[:10]],
        "recent_topic_sessions": compact_sessions,
        "investigated_topics": inquiry_topics[:10],
        "activity_average": {
            "score_percent": round(sum(activity_scores) / len(activity_scores) * 100) if activity_scores else 0,
            "exercise_time_ms": round(sum(activity_times) / len(activity_times)) if activity_times else 0,
            "average_per_question_ms": round(sum(activity_times) / total_questions) if total_questions else 0,
            "attempts": len(activity_scores),
        },
        "topic_comparisons": topic_comparisons[:5],
        "explanation_requests_by_section": [
            {"topic": topic, "section": section, "times": count}
            for (topic, section), count in section_requests.most_common(20)
        ],
        "investigation_count": investigation_count,
    }
    evidence_hash = hashlib.sha256(json.dumps(current_evidence, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    previous = await repo.get_student_learning_overview(student_id)
    if previous and previous.get("evidence_hash") == evidence_hash:
        return previous
    source = json.dumps({
        **current_evidence,
        "counts": {
            "activity_count": total_activity_count,
            "distinct_investigated_topics": inquiry_count,
            "investigated_topics": inquiry_topics[:10],
            "completed_summaries": int(evidence.get("resumenesCompletados", sum(1 for item in events if item.get("tipo") == "resumen_completado"))),
            "completed_learning_topics": completed_topic_count,
            "completed_topic_sessions": sum(1 for item in events if item.get("tipo") == "tema_completado"),
            "investigation_count": investigation_count,
            "average_score_percent": current_evidence["activity_average"]["score_percent"],
            "average_exercise_time_ms": current_evidence["activity_average"]["exercise_time_ms"],
            "average_per_question_ms": current_evidence["activity_average"]["average_per_question_ms"],
        },
    }, ensure_ascii=False)
    model = settings.ollama_mistral_model
    if len(source) > 12_000:
        logger.warning("Evidencia extensa; se devuelve síntesis local student_id=%s chars=%s", student_id, len(source))
        profile_fields = _resumen_determinista(activities, events, progress, compact_sessions, inquiry_topics)
        model = "evidencia_local"
    else:
        try:
            async with semaphore:
                async with asyncio.timeout(40):
                    analysis = await llm.structured(
                        model,
                        "mistral/learning_overview.txt",
                        source,
                        StudentLearningOverview,
                        max_tokens_override=450,
                    )
            profile_fields = analysis.model_dump()
        except Exception:
            logger.exception("No se pudo completar el análisis LLM; se genera una síntesis basada en evidencia student_id=%s", student_id)
            profile_fields = _resumen_determinista(activities, events, progress, compact_sessions, inquiry_topics)
            model = "evidencia_local"
    result = {
        "ready": True,
        **profile_fields,
        "investigated_topics_count": inquiry_count,
        "investigations_count": investigation_count,
        "deep_inquiry_topics": inquiry_topics[:10],
        "evidence_activity_count": total_activity_count,
        "completed_summaries": summary_count,
        "completed_topics": completed_topic_count,
        "evidence_hash": evidence_hash,
        "updated_at": repo.now(),
        "model": model,
    }
    await repo.save_student_learning_overview(student_id, result)
    return result


def _resumen_determinista(activities: list[dict], events: list[dict], progress: list[dict], sessions: list[dict], inquiry_topics: list[str]) -> dict:
    latest = activities[0] if activities else None
    valid_scores = [float(item.get("porcentaje", 0) or 0) for item in activities if item.get("porcentaje") is not None]
    times = [int(item.get("duracionMs", 0) or 0) for item in activities if int(item.get("duracionMs", 0) or 0) > 0]
    question_count = sum(int(item.get("preguntasTotal", 0) or 0) for item in activities)
    sections = [
        str(section)
        for item in sessions
        for section in item.get("explained_sections", [])
        if str(section).strip()
    ]
    sections.extend(
        str(section)
        for item in events if item.get("tipo") in {"tema_completado", "resumen_completado"}
        for section in item.get("partesExplicadas", [])
        if str(section).strip()
    )
    section_frequency = Counter(sections)
    if latest:
        score = round(float(latest.get("porcentaje", 0) or 0) * 100)
        elapsed = int(latest.get("duracionMs", 0) or 0) // 1000
        previous = None
        for item in activities[1:]:
            if latest.get("temaRutaId") and item.get("temaRutaId") == latest.get("temaRutaId"):
                previous = item
                break
            if not latest.get("temaRutaId") and item.get("materialId") == latest.get("materialId"):
                previous = item
                break
        if previous:
            diferencia = score - round(float(previous.get("porcentaje", 0) or 0) * 100)
            previo_segundos = int(previous.get("duracionMs", 0) or 0) // 1000
            cambio_nota = f"subió {diferencia} puntos" if diferencia > 0 else f"bajó {abs(diferencia)} puntos" if diferencia < 0 else "mantuvo la nota"
            cambio_tiempo = f"y tardó {abs(elapsed - previo_segundos)} segundos menos" if elapsed < previo_segundos else f"y tardó {elapsed - previo_segundos} segundos más" if elapsed > previo_segundos else "con el mismo tiempo"
            comparacion = f"Frente al intento anterior del mismo tema, {cambio_nota} {cambio_tiempo}."
        else:
            comparacion = "Este intento queda como referencia inicial para ese tema."
        average_score = round(sum(valid_scores) / len(valid_scores) * 100) if valid_scores else score
        average_time = round(sum(times) / len(times)) // 1000 if times else elapsed
        average_per_question = round(sum(times) / question_count / 1000, 1) if question_count else 0
        rhythm = f"Promedia {average_score}% de aciertos, {average_time // 60}:{average_time % 60:02d} por actividad y {average_per_question} s por pregunta. En el intento más reciente obtuvo {score}% y tardó {elapsed // 60}:{elapsed % 60:02d}. {comparacion}"
    elif sessions or any(item.get("tipo") == "tema_completado" for item in events):
        tiempo = sum(int(item.get("reading_ms", 0) or 0) for item in sessions) // 1000
        rhythm = f"Completó {len(sessions) or sum(1 for item in events if item.get('tipo') == 'tema_completado')} sesiones de tema y acumuló {tiempo // 60}:{tiempo % 60:02d} de lectura reciente; se guardaron las partes consultadas."
    elif progress:
        rhythm = f"Tiene {len(progress)} temas en progreso, con avance guardado por cartas."
    else:
        rhythm = "Aún no hay actividades ni sesiones de estudio registradas."
    strengths = []
    if valid_scores:
        best = max(valid_scores)
        if best >= 0.8:
            strengths.append(f"Alcanzó {round(best * 100)}% de aciertos en uno de sus intentos recientes.")
        elif best >= 0.5:
            strengths.append(f"Respondió correctamente {round(best * 100)}% en su mejor intento reciente.")
    mejoras = []
    por_tema: dict[str, list[dict]] = {}
    for item in activities:
        topic_id = str(item.get("temaRutaId") or item.get("materialId") or "")
        if topic_id:
            por_tema.setdefault(topic_id, []).append(item)
    for intentos in por_tema.values():
        if len(intentos) < 2:
            continue
        primero = float(intentos[-1].get("porcentaje", 0) or 0)
        ultimo = float(intentos[0].get("porcentaje", 0) or 0)
        if ultimo > primero:
            nombre = str(intentos[0].get("tituloTema") or intentos[0].get("titulo") or "el tema")
            mejoras.append(f"En {nombre} mejoró {round((ultimo - primero) * 100)} puntos porcentuales al repetir el reto.")
    strengths.extend(mejoras[:2])
    if sessions:
        strengths.append(f"Completó {len(sessions)} sesiones de lectura vinculadas a temas del material.")
    orientation = "practico" if activities and not sessions else "teorico" if sessions and not activities else "equilibrado"
    recommendation = (
        f"Vuelve a revisar {', '.join(section for section, _ in section_frequency.most_common(2))} y resuelve un reto corto del mismo tema."
        if sections else "Continúa con el siguiente tema y completa una actividad para comparar tus resultados."
    )
    return {
        "learning_rhythm": rhythm,
        "strengths": strengths[:6],
        "learning_orientation": orientation,
        "preferred_formats": ["cartas"] if sessions else ["ejercicios_practicos"] if activities else [],
        "investigated_topics_count": len(inquiry_topics),
        "deep_inquiry_topics": inquiry_topics[:10],
        "possible_ambitions": [],
        "personalization_recommendation": recommendation,
        "confidence": "baja",
    }
