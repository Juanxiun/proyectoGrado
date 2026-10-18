import json
import logging
from pathlib import Path
from typing import TypeVar

import httpx
import ollama
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)
PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
FRAMEWORKS = {
    "microlearning_framework": (PROMPTS / "microlearning.txt").read_text(encoding="utf-8"),
    "inquiry_framework": (PROMPTS / "inquiry_based_learning.txt").read_text(encoding="utf-8"),
}


def _model_names(response) -> set[str]:
    models = getattr(response, "models", None)
    if models is None and isinstance(response, dict):
        models = response.get("models", [])
    names = set()
    for item in models or []:
        name = getattr(item, "model", None) or getattr(item, "name", None)
        if name is None and isinstance(item, dict):
            name = item.get("model") or item.get("name")
        if name:
            names.add(str(name))
    return names


def _matching_tag(configured: str, installed: set[str]) -> str | None:
    if not configured:
        return None
    if configured in installed:
        return configured
    # ollama -> modelo sin tag se reporta como latest
    if ":" not in configured and f"{configured}:latest" in installed:
        return f"{configured}:latest"
    return None


class OllamaClient:
    def __init__(self) -> None:
        self.client = ollama.AsyncClient(
            host=settings.ollama_base_url.rstrip("/"),
            timeout=settings.llm_request_timeout,
        )
        # ollama -> timeout de conexion del httpx subyacente
        if hasattr(self.client._client, "timeout"):
            self.client._client.timeout = httpx.Timeout(
                timeout=settings.llm_request_timeout,
                connect=settings.llm_connect_timeout,
            )

    # ollama -> cierre del cliente http en el apagado
    async def close(self) -> None:
        await self.client._client.aclose()

    async def installed_models(self) -> set[str]:
        return _model_names(await self.client.list())

    async def missing_models(self) -> list[str]:
        installed = await self.installed_models()
        expected = {
            "OLLAMA_GEMMA_MODEL": settings.ollama_gemma_model,
            "OLLAMA_MISTRAL_MODEL": settings.ollama_mistral_model,
            "OLLAMA_EMBEDDING_MODEL": settings.ollama_embedding_model,
        }
        return [f"{key}={value!r}" for key, value in expected.items() if not _matching_tag(value, installed)]

    async def ready(self) -> bool:
        return not await self.missing_models()

    # ollama -> prueba real de inferencia y embeddings
    async def startup_self_test(self) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for key, model in (("gemma", settings.ollama_gemma_model), ("mistral", settings.ollama_mistral_model)):
            response = await self.client.generate(
                model=model,
                prompt="Responde únicamente: OK",
                stream=False,
                options={"num_predict": 4, "temperature": 0, "num_ctx": settings.ollama_num_ctx},
            )
            results[key] = bool(getattr(response, "response", "").strip())
        embedding = await self.embed("prueba de inicio del indice academico RAG")
        results["embeddings"] = bool(embedding)
        return results

    async def structured(self, model: str, prompt_name: str, context: str, schema: type[T]) -> T:
        prompt = (PROMPTS / prompt_name).read_text(encoding="utf-8")
        for key, document in FRAMEWORKS.items():
            prompt = prompt.replace("{{" + key + "}}", document)
        prompt = prompt.replace("{{context}}", context)
        errors = ""
        output_limits = {"ChunkAnalysisBatch": 1200, "RefinedContent": 2000, "ContentEvaluation": 500, "ActivitySet": 2800}
        max_attempts = 1 if schema.__name__ in {"RefinedContent", "ContentEvaluation"} else 2
        for attempt in range(max_attempts):
            strict = "\nDevuelve únicamente JSON válido que cumpla exactamente el esquema solicitado. No uses Markdown."
            response_format = "json" if schema.__name__ == "RefinedContent" else schema.model_json_schema()
            response = await self.client.generate(
                model=model,
                prompt=prompt + errors + (strict if attempt else ""),
                stream=False,
                format=response_format,
                options={"temperature": 0.2, "num_ctx": settings.ollama_num_ctx,
                         "num_predict": output_limits.get(schema.__name__, 1600)},
            )
            raw = getattr(response, "response", "")
            try:
                return schema.model_validate_json(raw)
            except (ValidationError, ValueError) as exc:
                logger.warning("JSON/esquema invalido modelo=%s tipo=%s intento=%s detalle=%s",
                               model, schema.__name__, attempt + 1, str(exc)[:500])
                errors = (
                    f"\nEl JSON anterior incumplio el esquema por este error: {json.dumps(str(exc))}. "
                    "Corrige el objeto completo y verifica todos los campos. "
                    f"JSON anterior: {json.dumps(raw[:12000], ensure_ascii=False)}\n"
                )
        raise ValueError(f"El modelo {model} no entregó una respuesta estructurada válida")

    async def embed(self, text: str) -> list[float]:
        if not settings.ollama_embedding_model:
            raise RuntimeError("Configure OLLAMA_EMBEDDING_MODEL con un modelo ya instalado para habilitar RAG vectorial")
        response = await self.client.embed(model=settings.ollama_embedding_model, input=text)
        embeddings = getattr(response, "embeddings", [])
        if not embeddings or not embeddings[0]:
            raise ValueError("Ollama no devolvió el embedding solicitado")
        return embeddings[0]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        if not settings.ollama_embedding_model:
            raise RuntimeError("Configure OLLAMA_EMBEDDING_MODEL con un modelo ya instalado para habilitar RAG vectorial")
        if not texts:
            return []
        response = await self.client.embed(model=settings.ollama_embedding_model, input=texts)
        embeddings = getattr(response, "embeddings", [])
        if len(embeddings) != len(texts) or any(not vector for vector in embeddings):
            raise ValueError("Ollama no devolvió todos los embeddings solicitados")
        return embeddings
