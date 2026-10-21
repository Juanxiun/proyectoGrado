import logging

from app.lmstudio import LMStudioClient
from app.RAG.repository import RAGRepository

logger = logging.getLogger(__name__)

# summaries -> formato avanzado de resumen personalizado (ESQUEMA_GEMMA y CARTAS_EXPLICATIVAS)
FORMATOS = {"ESQUEMA_GEMMA", "CARTAS_EXPLICATIVAS"}

# summaries -> seleccion de formato (solo ESQUEMA_GEMMA o CARTAS_EXPLICATIVAS)
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


# summaries -> adaptar esquema validado a tarjetas educativas
def _datos_por_formato(data: dict, formato: str, titulo: str) -> dict:
    if formato != "CARTAS_EXPLICATIVAS":
        return data
    nodos = data.get("nodes", [])
    edges = data.get("edges", [])
    if not nodos and data.get("cards"):
        cards = []
        for item in data["cards"]:
            concept = str(item.get("concept") or item.get("title") or item.get("front") or "Concepto clave").strip()
            definition = str(item.get("definition") or item.get("detail") or item.get("back") or item.get("explanation") or "").strip()
            points = [str(point).strip() for point in item.get("key_points", []) if str(point).strip()]
            cards.append({"concept": concept, "definition": definition, "key_points": points[:3]})
        return {"title": data.get("title") or titulo, "cards": cards, "recommendation": data.get("recommendation") or "Explica con tus palabras cómo se conectan estos conceptos."}
    cartas = []
    for nodo in nodos:
        relaciones = []
        for edge in edges:
            if nodo.get("id") not in (edge.get("source"), edge.get("target")):
                continue
            otro_id = edge.get("target") if edge.get("source") == nodo.get("id") else edge.get("source")
            otro = next((item.get("label") for item in nodos if item.get("id") == otro_id), None)
            if otro:
                relaciones.append(f"{edge.get('label', 'se relaciona con')}: {otro}")
        cartas.append({
            "concept": nodo.get("label", "Concepto clave"),
            "definition": nodo.get("detail") or nodo.get("label", ""),
            "key_points": relaciones[:3],
        })
    return {
        "title": titulo,
        "cards": cartas,
        "recommendation": "Explica con tus palabras cómo se conectan estos conceptos.",
    }


# summaries -> construir esquema desde contenido aprobado
def _esquema_desde_contenido(content: dict) -> dict:
    unidades = content.get("microlearning_units", [])
    conceptos = content.get("key_concepts", [])
    candidatos = []
    titulo = str(content.get("title") or "Tema principal").strip()
    resumen = str(content.get("summary") or "").strip()
    candidatos.append({"id": "tema-principal", "label": titulo[:80], "kind": "concepto", "detail": resumen[:1200] or titulo})
    for unidad in unidades[:8]:
        label = str(unidad.get("title") or "").strip()
        detail = str(unidad.get("explanation") or unidad.get("objective") or label).strip()
        if label and label.casefold() != titulo.casefold():
            candidatos.append({"id": f"unidad-{len(candidatos)}", "label": label[:80], "kind": "procedimiento", "detail": detail[:1200]})
    for concepto in conceptos:
        label = str(concepto).strip()
        if label and all(label.casefold() != item["label"].casefold() for item in candidatos):
            candidatos.append({"id": f"concepto-{len(candidatos)}", "label": label[:80], "kind": "concepto", "detail": resumen[:1200] or label})
        if len(candidatos) >= 12:
            break
    if len(candidatos) == 1:
        candidatos.extend({"id": f"idea-{i}", "label": f"Idea clave {i}", "kind": "concepto", "detail": resumen or titulo} for i in range(1, 5))
    edges = [{"source": candidatos[index]["id"], "target": candidatos[index + 1]["id"], "label": "se relaciona"} for index in range(len(candidatos) - 1)]
    relacionados = [item["label"] for item in candidatos[1:7]]
    while len(relacionados) < 3:
        relacionados.append(titulo)
    return {"title": titulo, "nodes": candidatos, "edges": edges, "related_topics": relacionados[:6]}


# summaries -> generacion o recuperacion del resumen avanzado (ESQUEMA_GEMMA / CARTAS_EXPLICATIVAS)
async def generate_learning_summary(content_id: str, formato: str, repo: RAGRepository, llm: LMStudioClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar resumenes")
    if formato == "auto":
        formato = "ESQUEMA_GEMMA"
    if formato not in FORMATOS:
        raise ValueError(f"Formato de resumen no admitido: {formato}")
    cache = await repo.get_summary_cache(content_id, formato)
    if cache:
        datos_cache = _datos_por_formato(cache.get("data", {}) if isinstance(cache.get("data"), dict) else {}, formato, str(content.get("title") or "Resumen del tema"))
        tarjetas_utiles = any(
            len(str(item.get("concept", "")).strip()) > 2 and len(str(item.get("definition", "")).strip()) > 25
            for item in datos_cache.get("cards", [])
        )
        if (formato == "CARTAS_EXPLICATIVAS" and tarjetas_utiles) or (formato == "ESQUEMA_GEMMA" and datos_cache.get("nodes")):
            cache["data"] = _limpiar_salida(datos_cache)
            return cache
    schema = _esquema_desde_contenido(content)
    resultado = {
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "formato": formato,
        "data": _limpiar_salida(_datos_por_formato(schema, formato, str(content.get("title") or "Resumen del tema"))),
        "quality_score": 1.0,
        "quality_evaluation": {"approved": True, "score": 1.0, "reason": "Construido desde contenido aprobado"},
        "source_chunk_ids": [],
        "generated_at": repo.now(),
    }
    await repo.set_summary_cache(content_id, formato, resultado)
    logger.info("Resumen avanzado generado content_id=%s formato=%s", content_id, formato)
    return resultado


# LLM -> fase 3b esquema gemma
async def generate_schema(content_id: str, repo: RAGRepository, llm: LMStudioClient, semaphore) -> dict:
    content = await repo.get_validated_content(content_id)
    if not content:
        raise LookupError("El material aun no tiene contenido validado para generar esquema")
    cache = await repo.get_summary_cache(content_id, "ESQUEMA_GEMMA")
    if cache and isinstance(cache.get("data"), dict) and cache.get("data", {}).get("nodes"):
        cache["data"] = _limpiar_salida(cache.get("data", {}))
        return cache
    schema = _esquema_desde_contenido(content)
    resultado = {
        "content_id": content_id,
        "document_id": content.get("document_id"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "formato": "ESQUEMA_GEMMA",
        "data": _limpiar_salida(schema),
        "quality_score": 1.0,
        "quality_evaluation": {"approved": True, "score": 1.0, "reason": "Construido desde contenido aprobado"},
        "source_chunk_ids": [],
        "generated_at": repo.now(),
    }
    await repo.set_summary_cache(content_id, "ESQUEMA_GEMMA", resultado)
    logger.info("Esquema Gemma generado content_id=%s", content_id)
    return resultado
