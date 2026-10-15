import json
import logging

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import (
    CartasExplicativas,
    Conexiones,
    MapaEsquematico,
    ContentEvaluation,
)

logger = logging.getLogger(__name__)

# summaries -> formatos avanzados de resumen personalizado
FORMATOS = {
    "CARTAS_EXPLICATIVAS": CartasExplicativas,
    "CONEXIONES": Conexiones,
    "MAPA_ESQUEMATICO": MapaEsquematico,
}

# summaries -> seleccion de formato segun el tipo de contenido analizado
def elegir_formato(content: dict) -> str:
    conceptos = content.get("key_concepts", [])
    unidades = content.get("microlearning_units", [])
    if 3 <= len(conceptos) < 8 and len(unidades) >= 3:
        return "CONEXIONES"
    if len(conceptos) >= 8 or len(unidades) >= 6:
        return "MAPA_ESQUEMATICO"
    return "CARTAS_EXPLICATIVAS"


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


# summaries -> generacion o recuperacion del resumen avanzado
async def generate_learning_summary(content_id: str, formato: str, repo: RAGRepository, llm: OllamaClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar resumenes")
    if formato != "auto" and formato not in FORMATOS:
        raise ValueError(f"Formato de resumen no admitido: {formato}")
    cache = await repo.get_summary_cache(content_id, formato)
    if cache:
        cache["data"] = _limpiar_salida(cache.get("data", {}))
        cache["data"].setdefault("recommendation", "¿Qué concepto del tema te gustaría investigar y explicar con tus propias palabras?")
        return cache
    evidencia = await _evidencia(content_id, content, repo, llm, semaphore)
    if formato == "auto":
        formato = elegir_formato(content)
    entrada_base = {
        "formato_solicitado": formato,
        "titulo": content.get("title"),
        "resumen_validado": content.get("summary"),
        "objetivos": content.get("learning_objectives", []),
        "conceptos": content.get("key_concepts", []),
        "unidades_microlearning": content.get("microlearning_units", []),
        "errores_comunes": content.get("common_mistakes", []),
        **evidencia,
    }
    resumen = None
    evaluacion = None
    revision_gemma: list[str] = []
    for _ in range(max(1, settings.llm_max_refinement_iterations)):
        entrada = {**entrada_base, "revision_gemma": revision_gemma}
        async with semaphore:
            resumen = await llm.structured(
                settings.ollama_mistral_model,
                "mistral/summary_formats.txt",
                json.dumps(entrada, ensure_ascii=False),
                FORMATOS[formato],
            )
        evidencia_revision = json.dumps({"evidencia_validada": entrada_base, "borrador": resumen.model_dump()}, ensure_ascii=False)
        try:
            async with semaphore:
                evaluacion = await llm.structured(
                    settings.ollama_gemma_model,
                    "gemma/evaluate_learning.txt",
                    evidencia_revision,
                    ContentEvaluation,
                )
        except Exception as exc:
            logger.warning("Evaluacion del resumen no disponible content_id=%s: %s", content_id, str(exc)[:300])
            evaluacion = ContentEvaluation(
                approved=False,
                confidence=0,
                score=0,
                fidelity=0,
                coverage=0,
                coherence=0,
                pedagogy=0,
                issues=["El evaluador automatico no devolvio una respuesta valida."],
                required_changes=[],
                reason="Se conserva el borrador que cumple el esquema del formato solicitado.",
            )
            break
        puntuacion_rubrica = sum((evaluacion.fidelity, evaluacion.coverage, evaluacion.coherence, evaluacion.pedagogy)) / 4
        evaluacion.score = min(evaluacion.score, puntuacion_rubrica)
        evaluacion.approved = evaluacion.approved and evaluacion.score >= settings.llm_acceptance_threshold
        if evaluacion.approved:
            break
        revision_gemma = evaluacion.required_changes or evaluacion.issues
    if not resumen:
        raise ValueError("No se pudo generar el resumen del material")
    if not evaluacion or not evaluacion.approved:
        logger.warning("Resumen bajo umbral content_id=%s formato=%s; se entrega el mejor borrador", content_id, formato)
    resultado = {
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "formato": formato,
        "data": _limpiar_salida(resumen.model_dump()),
        "quality_score": round(evaluacion.score, 4),
        "quality_evaluation": evaluacion.model_dump(),
        "source_chunk_ids": [item.get("chunk_id", "") for item in evidencia["contexto_conceptual"]],
        "generated_at": repo.now(),
    }
    await repo.set_summary_cache(content_id, formato, resultado)
    logger.info("Resumen avanzado generado content_id=%s formato=%s", content_id, formato)
    return resultado
