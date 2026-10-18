import json
import logging
import uuid

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ActivitySet, ContentEvaluation, SchemaOutput
from app.services.activities import (
    activity_statement,
    fingerprint,
    normalize_activity,
    public_activity,
    _is_seed_format,
)

logger = logging.getLogger(__name__)

# activities -> tipos admitidos para mezclar una prueba (LEGACY: formatos de interaccion UI)
TIPOS_ACTIVIDAD = (
    "SELECCION_MULTIPLE",
    "CUESTIONARIO",
    "FLASHCARD",
    "VERDADERO_FALSO",
    "CONECTAR_FRASES",
    "DRAG_AND_DROP",
)

# activities -> tipos de reactivo Fase 2 (nuevo formato unificado)
TIPOS_REACTIVO = ("THEORETICAL", "PRACTICAL")


# activities -> obtener tipo de actividad para agrupamiento (compatibilidad ambos formatos)
def _get_activity_type(actividad: dict) -> str:
    if _is_seed_format(actividad):
        return actividad.get("type", "THEORETICAL")
    return actividad.get("tipo", "SELECCION_MULTIPLE")


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
        por_tipo.setdefault(_get_activity_type(actividad), []).append(actividad)
    for lista in por_tipo.values():
        lista.sort(key=lambda item: (item.get("difficulty") != dificultad, str(item.get("difficulty", "inicial"))))
    # Unir preferencias de ambos sistemas de tipos
    todos_tipos = list(por_tipo.keys())
    preferencias = {tipo: index for index, tipo in enumerate(formatos_recomendados or [])}
    orden = sorted(todos_tipos, key=lambda tipo: (preferencias.get(tipo, len(preferencias)), -len(por_tipo.get(tipo, []))))
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


# activities -> emision de prueba con actividades gamificadas (Fase 3C: Gemma reestructura)
async def issue_quiz(student_id: str, content_id: str, activity_count: int, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar actividades")
    profile = await repo.get_student_profile(student_id, content_id)
    difficulty = profile.get("difficulty_level", "inicial") if profile else "inicial"
    
    # Obtener quiz gamificado reestructurado por Gemma (cacheado por contenido)
    cache_key = f"gamified_quiz:{content_id}"
    cached = await repo.get_cache(cache_key)
    if cached:
        gamified = json.loads(cached)
    else:
        gamified = await generate_gamified_quiz(content_id, repo, llm, semaphore)
        await repo.set_cache(cache_key, json.dumps(gamified, ensure_ascii=False), 86400)
    
    # Seleccionar actividades del quiz gamificado según dificultad y historial del estudiante
    used_ids, used_statements = await repo.student_used_questions(student_id, content_id)
    used_fingerprints = {fingerprint(statement) for statement in used_statements}
    
    # Convertir actividades gamificadas a formato interno
    selected = _seleccionar_actividades_gamificadas(
        gamified.get("actividades", []),
        activity_count,
        difficulty,
        used_fingerprints,
        profile.get("recommended_formats", []) if profile else [],
    )
    
    if len(selected) < 5:
        logger.error(
            "Actividades gamificadas insuficientes content_id=%s solicitadas=%s disponibles=%s",
            content_id, activity_count, len(selected),
        )
        raise ValueError("El material no tiene suficientes actividades gamificadas únicas para iniciar la práctica")
    
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


def _seleccionar_actividades_gamificadas(
    actividades_gamificadas: list[dict],
    cantidad: int,
    dificultad: str,
    used_fingerprints: set[str],
    formatos_recomendados: list[str],
) -> list[dict]:
    # Filtrar por dificultad objetivo y huellas no usadas
    disponibles = []
    for act in actividades_gamificadas:
        fp = fingerprint(act.get("contenido", {}).get("parrafo", "") or act.get("contenido", {}).get("enunciado", "") or str(act))
        if fp in used_fingerprints:
            continue
        act["fingerprint"] = fp
        act["difficulty"] = act.get("dificultad", "inicial")
        disponibles.append(act)
    
    # Ordenar por preferencia de dificultad y formato
    orden_dificultad = {"inicial": 0, "intermedia": 1, "avanzada": 2}
    objetivo = orden_dificultad.get(dificultad, 0)
    disponibles.sort(key=lambda a: abs(orden_dificultad.get(a.get("difficulty", "inicial"), 0) - objetivo))
    
    return disponibles[:cantidad]


# LLM -> fase 3c actividad gemma
async def generate_gamified_quiz(content_id: str, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar actividades gamificadas")
    activities_bank = await repo.get_activity_bank(content_id)
    if len(activities_bank) < 20:
        raise ValueError("Se requieren al menos 20 reactivos validados (10 teóricos + 10 prácticos) para reestructurar")
    entrada = {
        "titulo": content.get("title"),
        "resumen": content.get("summary"),
        "objetivos": content.get("learning_objectives", []),
        "conceptos": content.get("key_concepts", []),
        "actividades_banco": activities_bank[:20],
    }
    async with semaphore:
        restructured = await llm.structured(
            settings.ollama_gemma_model,
            "gemma/restructure_quiz.txt",
            json.dumps(entrada, ensure_ascii=False),
            dict,
        )
    return restructured
