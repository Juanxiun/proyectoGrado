import hashlib
import json
import re
import uuid

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import QuizQuestionSet


def _fingerprint(question: str) -> str:
    normalized = re.sub(r"\s+", " ", question.casefold()).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


async def issue_quiz(student_id: str, content_id: str, question_count: int, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar cuestionarios")
    profile = await repo.get_student_profile(student_id, content_id)
    difficulty = profile.get("difficulty_level", "inicial") if profile else "inicial"
    used_ids, used_statements = await repo.student_used_questions(student_id, content_id)
    fingerprints = {_fingerprint(statement) for statement in used_statements}
    bank = await repo.get_question_bank(content_id)
    available = [
        question for question in bank
        if question.get("question_id") not in used_ids
        and _fingerprint(question.get("question", "")) not in fingerprints
    ]
    unique_available = []
    seen_fingerprints = set(fingerprints)
    for question in available:
        fingerprint = _fingerprint(question.get("question", ""))
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)
        unique_available.append(question)
    available = unique_available
    available.sort(key=lambda question: (question.get("difficulty") != difficulty, question.get("difficulty", "inicial")))
    selected = available[:question_count]

    if len(selected) < question_count:
        wanted = question_count - len(selected)
        evidence = {
            "material_validado": {
                "title": content.get("title"),
                "summary": content.get("summary"),
                "learning_objectives": content.get("learning_objectives", []),
                "key_concepts": content.get("key_concepts", []),
                "microlearning_units": content.get("microlearning_units", []),
                "inquiry_questions": content.get("inquiry_questions", []),
            },
            "perfil_del_estudiante": profile,
            "dificultad_objetivo": difficulty,
            "preguntas_ya_utilizadas": used_statements,
            "preguntas_seleccionadas_para_este_cuestionario": [item.get("question") for item in selected],
            "preguntas_nuevas_requeridas": question_count,
        }
        async with semaphore:
            generated = await llm.structured(
                settings.ollama_mistral_model,
                "mistral/generate_quiz.txt",
                json.dumps(evidence, ensure_ascii=False),
                QuizQuestionSet,
            )
        for question in generated.questions:
            data = question.model_dump()
            fingerprint = _fingerprint(data["question"])
            if fingerprint in fingerprints:
                continue
            data["question_id"] = hashlib.sha256(f"{content_id}:{uuid.uuid4()}".encode()).hexdigest()
            data["fingerprint"] = fingerprint
            selected.append(data)
            fingerprints.add(fingerprint)
            if len(selected) == question_count:
                break

    if len(selected) < question_count:
        raise ValueError("No fue posible generar suficientes preguntas nuevas; revise el contenido validado y vuelva a intentar")

    issued = []
    for item in selected:
        question = {**item}
        question.setdefault("question_id", hashlib.sha256(f"{content_id}:{question.get('question')}".encode()).hexdigest())
        question["fingerprint"] = question.get("fingerprint") or _fingerprint(question["question"])
        question["difficulty"] = question.get("difficulty") if question.get("difficulty") in {"inicial", "intermedia", "avanzada"} else difficulty
        issued.append(question)

    quiz_id = str(uuid.uuid4())
    if not await repo.save_quiz(student_id, content_id, quiz_id, issued):
        raise ValueError("Las preguntas fueron emitidas en otra solicitud simultánea; vuelva a solicitar el cuestionario")
    return {
        "quiz_id": quiz_id,
        "student_id": student_id,
        "content_id": content_id,
        "difficulty": difficulty,
        "question_count": question_count,
        "questions": [{key: question[key] for key in ("question_id", "question", "options", "difficulty", "learning_objective")} for question in issued],
    }
