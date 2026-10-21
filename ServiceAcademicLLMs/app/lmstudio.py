import json
import logging
from pathlib import Path
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)
PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


class StructuredOutputError(ValueError):
    pass


def _model_names(response: dict) -> set[str]:
    names = set()
    for item in response.get("data") or response.get("models", []):
        name = item.get("id") or item.get("model") or item.get("key")
        if name:
            names.add(str(name))
    return names


def _matching_tag(configured: str, installed: set[str]) -> str | None:
    if not configured:
        return None
    if configured in installed:
        return configured
    return None


class LMStudioClient:
    def __init__(self) -> None:
        self.base_url = settings.lmstudio_base_url.rstrip("/")
        configured_embedding_url = (settings.lmstudio_embedding_url or "").strip()
        self.embedding_url = (configured_embedding_url or self.base_url).rstrip("/")
        self.timeout = httpx.Timeout(
            timeout=settings.llm_request_timeout,
            connect=settings.llm_connect_timeout,
        )
        self.chat_client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout)
        self.embedding_client = httpx.AsyncClient(base_url=self.embedding_url, timeout=self.timeout)

    async def close(self) -> None:
        await self.chat_client.aclose()
        await self.embedding_client.aclose()

    async def installed_models(self) -> set[str]:
        # Con llama-server directo, los modelos están pre-cargados
        return {settings.lmstudio_gemma_model, settings.lmstudio_mistral_model, settings.lmstudio_embedding_model}

    async def missing_models(self) -> list[str]:
        # Con llama-server directo, asumimos que los modelos están cargados
        return []

    async def ready(self) -> bool:
        # Con llama-server directo, los modelos ya están cargados en los servidores
        return True

    async def load_model(self, model: str) -> bool:
        # No necesario con llama-server directo (modelos ya cargados)
        return True

    async def startup_self_test(self) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for key, model in (("gemma", settings.lmstudio_gemma_model), ("mistral", settings.lmstudio_mistral_model)):
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": "Responde únicamente: OK"}],
                "max_tokens": 4,
                "temperature": 0,
                "stream": False,
            }
            if model == settings.lmstudio_gemma_model:
                payload["chat_template_kwargs"] = {"enable_thinking": False}
            response = await self.chat_client.post(
                "/v1/chat/completions",
                json=payload,
            )
            results[key] = response.is_success and "OK" in response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        results["embeddings"] = bool(await self.embed("prueba de inicio del indice academico RAG"))
        return results

    async def _chat_completion(
        self,
        model: str,
        prompt: str,
        schema: type[T] | None = None,
        max_tokens: int = 1600,
        temperature: float = 0.2,
    ) -> tuple[str, str | None, dict, dict]:
        messages = [{"role": "user", "content": prompt}]
        response_format = None
        if schema:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "strict": True,
                    "schema": schema.model_json_schema(),
                },
            }
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        if model == settings.lmstudio_gemma_model:
            payload["chat_template_kwargs"] = {"enable_thinking": False}
        if response_format:
            payload["response_format"] = response_format
        response = await self.chat_client.post("/v1/chat/completions", json=payload)
        if response.is_error:
            detail = response.text[:5000]
            logger.error(
                "LM Studio rechazó chat model=%s status=%s detalle=%s",
                model,
                response.status_code,
                detail,
            )
            if "Context size has been exceeded" in detail:
                raise StructuredOutputError(
                    "LM Studio rechazó la solicitud porque el contexto efectivo del modelo fue excedido. "
                    "Reduzca el contexto enviado o aumente el contexto configurado al cargar el modelo."
                )
            if response_format and "response_format.type" in detail:
                logger.warning("Reintentando con response_format de tipo text...")
                payload["response_format"] = {"type": "text"}
                response = await self.chat_client.post("/v1/chat/completions", json=payload)
                if response.is_error:
                    if 400 <= response.status_code < 500:
                        raise StructuredOutputError(f"LM Studio rechazó la solicitud: {response.text[:1000]}")
                    response.raise_for_status()
            else:
                if 400 <= response.status_code < 500:
                    raise StructuredOutputError(f"LM Studio rechazó la solicitud: {detail[:1000]}")
                response.raise_for_status()
        else:
            response.raise_for_status()
        data = response.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = message.get("content") or ""
        if isinstance(content, list):
            content = "".join(str(item.get("text") or "") for item in content if isinstance(item, dict))
        usage = data.get("usage") or {}
        stats = data.get("stats") or {}
        logger.info(
            "LM Studio completó model=%s finish=%s prompt_tokens=%s completion_tokens=%s tokens_per_second=%s",
            model,
            choice.get("finish_reason"),
            usage.get("prompt_tokens", "?"),
            usage.get("completion_tokens", "?"),
            stats.get("tokens_per_second", "?"),
        )
        if not content and message.get("reasoning_content"):
            logger.warning("LM Studio no devolvió texto final model=%s; recibió contenido de razonamiento separado", model)
        return content, choice.get("finish_reason"), usage, stats

    async def structured(self, model: str, prompt_name: str, context: str, schema: type[T]) -> T:
        prompt = (PROMPTS / prompt_name).read_text(encoding="utf-8")
        prompt = prompt.replace("{{context}}", context)
        errors = ""
        output_limits = {
            "RefinedContent": 4000,
            "ActivityBankOutput": 4000,
            "ActivityBatchOutput": 4000,
            "ContentEvaluation": 1000,
            "ActivitySet": 4000,
        }
        max_attempts = 1 if schema.__name__ in {"RefinedContent", "ActivityBankOutput", "ActivityBatchOutput", "ContentEvaluation"} else 2
        last_error = "respuesta vacía"
        for attempt in range(max_attempts):
            strict = "\nDevuelve únicamente JSON válido que cumpla exactamente el esquema solicitado. No uses Markdown."
            full_prompt = prompt + errors + (strict if attempt else "")
            logger.info(
                "Solicitando salida estructurada model=%s schema=%s prompt_chars=%s max_tokens=%s",
                model,
                schema.__name__,
                len(full_prompt),
                output_limits.get(schema.__name__, 1600),
            )
            raw, finish_reason, usage, _stats = await self._chat_completion(
                model=model,
                prompt=full_prompt,
                schema=schema,
                max_tokens=output_limits.get(schema.__name__, 1600),
            )
            if finish_reason == "length":
                try:
                    complete_on_limit = schema.model_validate_json(raw)
                except (ValidationError, ValueError):
                    complete_on_limit = None
                if complete_on_limit is not None:
                    logger.warning("LM Studio llegó al límite de salida pero el JSON es válido model=%s schema=%s", model, schema.__name__)
                    return complete_on_limit
                details = usage.get("completion_tokens_details") or {}
                reasoning_tokens = details.get("reasoning_tokens", 0)
                if not raw and reasoning_tokens:
                    logger.error(
                        "Gemma agotó max_tokens en razonamiento model=%s reasoning_tokens=%s",
                        model,
                        reasoning_tokens,
                    )
                raise StructuredOutputError(
                    f"La respuesta de {model} alcanzó max_tokens={output_limits.get(schema.__name__, 1600)} "
                    f"(completion_tokens={usage.get('completion_tokens', '?')}, reasoning_tokens={reasoning_tokens})"
                )
            try:
                return schema.model_validate_json(raw)
            except (ValidationError, ValueError) as exc:
                logger.warning(
                    "JSON/esquema invalido modelo=%s tipo=%s intento=%s detalle=%s",
                    model,
                    schema.__name__,
                    attempt + 1,
                    str(exc)[:500],
                )
                last_error = str(exc)[:500]
                errors = f"\nLa salida anterior incumplio el esquema: {json.dumps(str(exc))}. Corrige el JSON completo.\n"
        raise StructuredOutputError(f"El modelo {model} no entregó una respuesta estructurada válida: {last_error}")

    async def embed(self, text: str) -> list[float]:
        if not settings.lmstudio_embedding_model:
            raise RuntimeError("Configure LMSTUDIO_EMBEDDING_MODEL con un modelo ya instalado para habilitar RAG vectorial")
        response = await self.embedding_client.post(
            "/v1/embeddings",
            json={"model": settings.lmstudio_embedding_model, "input": text},
        )
        response.raise_for_status()
        data = response.json()
        embeddings = data.get("data", [])
        if not embeddings or not embeddings[0].get("embedding"):
            raise ValueError("LM Studio no devolvió el embedding solicitado")
        return embeddings[0]["embedding"]

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        if not settings.lmstudio_embedding_model:
            raise RuntimeError("Configure LMSTUDIO_EMBEDDING_MODEL con un modelo ya instalado para habilitar RAG vectorial")
        if not texts:
            return []
        response = await self.embedding_client.post(
            "/v1/embeddings",
            json={"model": settings.lmstudio_embedding_model, "input": texts},
        )
        response.raise_for_status()
        data = response.json()
        embeddings = data.get("data", [])
        if len(embeddings) != len(texts) or any(not e.get("embedding") for e in embeddings):
            raise ValueError("LM Studio no devolvió todos los embeddings solicitados")
        return [e["embedding"] for e in embeddings]
