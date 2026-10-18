import json
import logging

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import (
    SchemaOutput,
    ContentEvaluation,
)

logger = logging.getLogger(__name__)

# summaries -> formato avanzado de resumen personalizado (solo ESQUEMA_GEMMA)
FORMATOS = {
    "ESQUEMA_GEMMA": SchemaOutput,
}

# summaries -> seleccion de formato (solo ESQUEMA_GEMMA)
def elegir_formato(content: dict) -> str:
    return "ESQUEMA_GEMMA"


def _limpiar_salida(valor):
    if isinstance(valor, dict):
        return {clave: _limpiar_salida(item) for clave, item in valor.items()}
    if isinstance(valor, list):
        elementos = [_limpiar_salida(item) for item in valor]
        return [item for item in elementos if not isinstance(item, str) or any(caracter.isalnum() for caracter in item)]
    if isinstance(valor, str):
        return valor.strip()
    return valor


# summaries -> recuperacion conceptual del contenido
async def _evidencia(content_id: str, content: dict, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    consulta = " ".join([str(content.get("title") or ""), *content.get("key_concepts", [])[:6]])
    async with semaphore:
        vector = await llm.embed(consulta)
    scope = {"content_id": content_id, "record_type": "theory_context"}
    teoria = await repo.vector_search(vector, limit=6, filters=scope)
    return {"contexto_conceptual": teoria}


# summaries -> generacion o recuperacion del resumen avanzado (solo ESQUEMA_GEMMA)
async def generate_learning_summary(content_id: str, formato: str, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar resumenes")
    if formato != "auto" and formato not in FORMATOS:
        raise ValueError(f"Formato de resumen no admitido: {formato}")
    # Solo ESQUEMA_GEMMA es valido
    formato = "ESQUEMA_GEMMA"
    cache = await repo.get_summary_cache(content_id, formato)
    if cache:
        cache["data"] = _limpiar_salida(cache.get("data", {}))
        return cache
    evidencia = await _evidencia(content_id, content, repo, llm, semaphore)
    entrada = {
        "concepto_principal": content.get("title"),
        "resumen_microlearning": content.get("summary"),
        "conceptos_clave": content.get("key_concepts", []),
        "unidades_microlearning": content.get("microlearning_units", []),
        "objetivos": content.get("learning_objectives", []),
        "ejercicios_base": content.get("base_exercises", []),
        **evidencia,
    }
    async with semaphore:
        schema = await llm.structured(
            settings.ollama_gemma_model,
            "gemma/generate_schema.txt",
            json.dumps(entrada, ensure_ascii=False),
            SchemaOutput,
        )
    resultado = {
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "formato": formato,
        "data": _limpiar_salida(schema.model_dump()),
        "quality_score": 1.0,
        "quality_evaluation": {"approved": True, "score": 1.0, "reason": "Generado por Gemma desde RAG validado"},
        "source_chunk_ids": [item.get("chunk_id", "") for item in evidencia["contexto_conceptual"]],
        "generated_at": repo.now(),
    }
    await repo.set_summary_cache(content_id, formato, resultado)
    logger.info("Resumen avanzado generado content_id=%s formato=%s", content_id, formato)
    return resultado


# LLM -> fase 3b esquema gemma
async def generate_schema(content_id: str, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar esquema")
    cache = await repo.get_summary_cache(content_id, "ESQUEMA_GEMMA")
    if cache:
        cache["data"] = _limpiar_salida(cache.get("data", {}))
        return cache
    evidencia = await _evidencia(content_id, content, repo, llm, semaphore)
    entrada = {
        "concepto_principal": content.get("title"),
        "resumen_microlearning": content.get("summary"),
        "conceptos_clave": content.get("key_concepts", []),
        "unidades_microlearning": content.get("microlearning_units", []),
        "objetivos": content.get("learning_objectives", []),
        "ejercicios_base": content.get("base_exercises", []),
        **evidencia,
    }
    async with semaphore:
        schema = await llm.structured(
            settings.ollama_gemma_model,
            "gemma/generate_schema.txt",
            json.dumps(entrada, ensure_ascii=False),
            SchemaOutput,
        )
    resultado = {
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "formato": "ESQUEMA_GEMMA",
        "data": _limpiar_salida(schema.model_dump()),
        "quality_score": 1.0,
        "quality_evaluation": {"approved": True, "score": 1.0, "reason": "Generado por Gemma desde RAG validado"},
        "source_chunk_ids": [item.get("chunk_id", "") for item in evidencia["contexto_conceptual"]],
        "generated_at": repo.now(),
    }
    await repo.set_summary_cache(content_id, "ESQUEMA_GEMMA", resultado)
    logger.info("Esquema Gemma generado content_id=%s", content_id)
    return resultado
