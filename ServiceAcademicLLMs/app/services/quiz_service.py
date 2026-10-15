import json
import logging
import uuid

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ActivitySet, ContentEvaluation
from app.services.activities import (
    activity_statement,
    fingerprint,
    normalize_activity,
    public_activity,
)

logger = logging.getLogger(__name__)

# activities -> tipos admitidos para mezclar una prueba
TIPOS_ACTIVIDAD = (
    "SELECCION_MULTIPLE",
    "CUESTIONARIO",
    "FLASHCARD",
    "VERDADERO_FALSO",
    "CONECTAR_FRASES",
    "DRAG_AND_DROP",
)


# activities -> banco disponible filtrado por uso previo y huellas
def _disponibles(bank: list[dict], used_ids: set[str], used_fingerprints: set[str]) -> list[dict]:
    unicas: list[dict] = []
    vistos = set(used_fingerprints)
    for actividad in bank:
        if actividad.get("activity_id") in used_ids:
            continue
        huella = actividad.get("fingerprint") or fingerprint(activity_statement(actividad))
        if huella in vistos:
            continue
        vistos.add(huella)
        actividad = {**actividad, "fingerprint": huella}
        unicas.append(actividad)
    return unicas


# activities -> seleccion diversa por tipo y dificultad objetivo
def _seleccion_diversa(disponibles: list[dict], cantidad: int, dificultad: str, formatos_recomendados: list[str] | None = None) -> list[dict]:
    por_tipo: dict[str, list[dict]] = {}
    for actividad in disponibles:
        por_tipo.setdefault(actividad.get("tipo", "SELECCION_MULTIPLE"), []).append(actividad)
    for lista in por_tipo.values():
        lista.sort(key=lambda item: (item.get("difficulty") != dificultad, str(item.get("difficulty", "inicial"))))
    preferencias = {tipo: index for index, tipo in enumerate(formatos_recomendados or [])}
    orden = sorted(TIPOS_ACTIVIDAD, key=lambda tipo: (preferencias.get(tipo, len(preferencias)), -len(por_tipo.get(tipo, []))))
    seleccion: list[dict] = []
    while len(seleccion) < cantidad:
        avance = False
        for tipo in orden:
            lista = por_tipo.get(tipo) or []
            if lista:
                seleccion.append(lista.pop(0))
                avance = True
                if len(seleccion) == cantidad:
                    break
        if not avance:
            break
    return seleccion


# activities -> emision de prueba con actividades variadas
async def issue_quiz(student_id: str, content_id: str, activity_count: int, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar actividades")
    profile = await repo.get_student_profile(student_id, content_id)
    difficulty = profile.get("difficulty_level", "inicial") if profile else "inicial"
    used_ids, used_statements = await repo.student_used_questions(student_id, content_id)
    used_fingerprints = {fingerprint(statement) for statement in used_statements}
    bank = await repo.get_activity_bank(content_id)
    selected: list[dict] = []
    fallback_bank = _seleccion_diversa(
        _disponibles(bank, set(), set()), activity_count, difficulty,
        profile.get("recommended_formats", []) if profile else [],
    )
    evidence = {
        "material_validado": {
            "title": content.get("title"),
            "summary": content.get("summary"),
            "learning_objectives": content.get("learning_objectives", []),
            "key_concepts": content.get("key_concepts", []),
            "microlearning_units": content.get("microlearning_units", []),
            "inquiry_questions": content.get("inquiry_questions", []),
            "ejercicios_base": content.get("base_exercises", []),
        },
        "perfil_del_estudiante": profile,
        "dificultad_objetivo": difficulty,
        "actividades_ya_utilizadas": used_statements,
        "actividades_nuevas_requeridas": activity_count,
    }
    generated = None
    evaluation = None
    revision_gemma: list[str] = []
    for _ in range(max(1, settings.llm_max_refinement_iterations)):
        generation_context = {**evidence, "revision_gemma": revision_gemma}
        try:
            async with semaphore:
                generated = await llm.structured(
                    settings.ollama_mistral_model,
                    "mistral/generate_activities.txt",
                    json.dumps(generation_context, ensure_ascii=False),
                    ActivitySet,
                )
        except Exception as exc:
            logger.warning("Generacion dinamica no disponible content_id=%s: %s", content_id, str(exc)[:300])
            break
        review_context = json.dumps({
            "contenido_validado": evidence["material_validado"],
            "objetivos": evidence["material_validado"]["learning_objectives"],
            "dificultad_objetivo": difficulty,
            "actividades_propuestas": [item.model_dump() for item in generated.activities],
        }, ensure_ascii=False)
        try:
            async with semaphore:
                evaluation = await llm.structured(
                    settings.ollama_gemma_model,
                    "gemma/evaluate_activities.txt",
                    review_context,
                    ContentEvaluation,
                )
        except Exception as exc:
            logger.warning("Evaluacion de actividades no disponible content_id=%s: %s", content_id, str(exc)[:300])
            evaluation = ContentEvaluation(
                fidelity=0, coverage=0, coherence=0, pedagogy=0, score=0,
                approved=False, issues=["Evaluacion automatica no disponible"],
                required_changes=[], reason="Se conserva el borrador generado como respaldo",
            )
            break
        rubric_score = sum((evaluation.fidelity, evaluation.coverage, evaluation.coherence, evaluation.pedagogy)) / 4
        evaluation.score = min(evaluation.score, rubric_score)
        evaluation.approved = evaluation.approved and evaluation.score >= settings.llm_acceptance_threshold
        if evaluation.approved:
            break
        revision_gemma = evaluation.required_changes or evaluation.issues
    if generated:
        if not evaluation or not evaluation.approved:
            logger.warning("Actividades bajo umbral content_id=%s; se usan las mejor evaluadas", content_id)
        for index, actividad in enumerate(generated.activities, 1):
            data = normalize_activity(actividad.model_dump(), f"{content_id}:nueva:{uuid.uuid4()}", index)
            if data["fingerprint"] in used_fingerprints or any(item.get("fingerprint") == data["fingerprint"] for item in selected):
                continue
            selected.append(data)
            if len(selected) == activity_count:
                break
    if len(selected) < activity_count:
        fingerprints_selected = {item.get("fingerprint") for item in selected}
        selected.extend(item for item in fallback_bank if item.get("fingerprint") not in fingerprints_selected)
        selected = selected[:activity_count]

    if len(selected) >= 5 and len(selected) < activity_count:
        logger.warning(
            "Se emite practica reducida content_id=%s solicitadas=%s disponibles=%s",
            content_id, activity_count, len(selected),
        )
    if len(selected) < 5:
        logger.error(
            "Banco insuficiente para emitir actividad content_id=%s solicitadas=%s unicas_banco=%s generadas_validas=%s",
            content_id, activity_count, len(fallback_bank), len(selected),
        )
        raise ValueError("El material no tiene suficientes actividades únicas para iniciar la práctica")

    quiz_id = str(uuid.uuid4())
    issued = []
    for index, item in enumerate(selected, 1):
        actividad = normalize_activity(item, content_id, index)
        actividad["difficulty"] = actividad.get("difficulty") if actividad.get("difficulty") in {"inicial", "intermedia", "avanzada"} else difficulty
        issued.append(actividad)

    if not await repo.save_quiz(student_id, content_id, quiz_id, issued):
        raise ValueError("Las actividades fueron emitidas en otra solicitud simultánea; vuelva a solicitar la prueba")
    return {
        "quiz_id": quiz_id,
        "student_id": student_id,
        "content_id": content_id,
        "difficulty": difficulty,
        "activity_count": len(issued),
        "activities": [public_activity(actividad, semilla=quiz_id) for actividad in issued],
    }
