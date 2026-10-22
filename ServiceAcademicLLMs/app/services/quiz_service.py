import json
import logging
import uuid

from pydantic import BaseModel, Field

from app.config import settings
from app.ollama_client import OllamaClient, StructuredOutputError
from app.RAG.repository import RAGRepository
from app.services.activities import (
    activity_statement,
    fingerprint,
    normalize_activity,
    public_activity,
    _is_seed_format,
)

logger = logging.getLogger(__name__)


# LLM -> plan de reactivos elegido por Mistral sobre el banco validado
class PlanPrueba(BaseModel):
    seleccion: list[int] = Field(min_length=3, max_length=8)

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
    
    used_ids, used_statements = await repo.student_used_questions(student_id, content_id)
    used_fingerprints = {fingerprint(statement) for statement in used_statements}
    bank = await repo.get_activity_bank(content_id)
    if not bank:
        bank = content.get("activities", []) if isinstance(content.get("activities"), list) else []
    disponibles = _disponibles(bank, used_ids, used_fingerprints)
    if len(disponibles) < min(activity_count, 4):
        logger.warning(
            "Banco insuficiente content_id=%s solicitadas=%s disponibles=%s; se reutilizan reactivos",
            content_id, activity_count, len(disponibles),
        )
        disponibles = _disponibles(bank, set(), set())
    if not disponibles:
        raise ValueError("El material no tiene reactivos validados para iniciar la práctica")

    # activities -> emitir rapido reactivos validados con seleccion diversa
    selected = _seleccion_diversa(
        disponibles,
        activity_count,
        difficulty,
        profile.get("recommended_formats", []) if profile else [],
    )

    if len(selected) < 5:
        raise ValueError("El material todavía no tiene cinco actividades validadas para iniciar la práctica")
    
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
        "activities": [public_activity(actividad, semilla=quiz_id, banco=bank) for actividad in issued],
    }


# LLM -> seleccion y orden de reactivos validados mediante Mistral
async def _seleccionar_con_mistral(
    disponibles: list[dict],
    cantidad: int,
    dificultad: str,
    formatos_recomendados: list[str],
    llm: OllamaClient | None,
    semaphore,
) -> list[dict]:
    limite = min(len(disponibles), 24)
    candidatos = disponibles[:limite]
    respaldo = _seleccion_diversa(list(candidatos), cantidad, dificultad, formatos_recomendados)

    if llm is None or semaphore is None:
        return respaldo

    # LLM -> indice corto por reactivo para reducir tokens del prompt
    catalogo = [
        {
            "indice": posicion,
            "tipo": _get_activity_type(actividad),
            "nivel": str(actividad.get("difficulty") or "inicial"),
            "pregunta": str(actividad.get("question") or "")[:180],
        }
        for posicion, actividad in enumerate(candidatos, 1)
    ]
    contexto = json.dumps(
        {
            "cantidad": min(cantidad, limite),
            "dificultad_objetivo": dificultad,
            "formatos_recomendados": formatos_recomendados,
            "reactivos": catalogo,
        },
        ensure_ascii=False,
    )
    try:
        async with semaphore:
            plan = await llm.structured(
                settings.ollama_mistral_model,
                "mistral/quiz_selection.txt",
                contexto,
                PlanPrueba,
            )
    except StructuredOutputError as exc:
        logger.warning("Mistral no pudo planificar la prueba, se usa seleccion determinista: %s", str(exc)[:300])
        return respaldo
    except Exception as exc:
        logger.warning("Fallo al consultar Mistral para la prueba, se usa seleccion determinista: %s", str(exc)[:300])
        return respaldo

    elegidas: list[dict] = []
    vistos: set[str] = set()
    for indice in plan.seleccion:
        if not 1 <= indice <= len(candidatos):
            continue
        actividad = candidatos[indice - 1]
        clave = str(actividad.get("activity_id") or actividad.get("fingerprint") or indice)
        if clave in vistos:
            continue
        vistos.add(clave)
        elegidas.append(actividad)
        if len(elegidas) == cantidad:
            break

    # LLM -> completar con seleccion determinista si faltan reactivos
    for actividad in respaldo:
        if len(elegidas) >= cantidad:
            break
        clave = str(actividad.get("activity_id") or actividad.get("fingerprint") or "")
        if clave and clave not in vistos:
            vistos.add(clave)
            elegidas.append(actividad)
    return elegidas[:cantidad]
