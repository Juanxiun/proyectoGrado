import logging
from collections.abc import Mapping
from pathlib import Path
from typing import Any, TypeVar

import httpx
from ollama import AsyncClient, ResponseError
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)
PROMPTS = Path(__file__).resolve().parent.parent / "prompts"

# ollama -> limites de tokens de salida por esquema (equivalente a max_tokens)
OUTPUT_LIMITS = {
    # salida -> limites segun contrato
    "RefinedContent": 2200,
    "ActivityBankOutput": 4000,
    "ActivityBatchOutput": 1400,
    "ContentEvaluation": 1000,
    "ActivitySet": 1800,
    "GamifiedQuizOutput": 6144,
    "PersonalizedLearningContent": 480,
    "PersonalizedLearningDraft": 480,
    "StudentLearningAnalysis": 1400,
    "QuizQualityFeedback": 220,
}

# ollama -> esquemas grandes sin reintento por limite de salida
SIN_REINTENTO = {
    "ActivityBankOutput",
    "ActivityBatchOutput",
    "ContentEvaluation",
    "GamifiedQuizOutput",
}

# ollama -> errores de contexto agotado
CONTEXT_MARKERS = (
    "context length",
    "context size",
    "exceeds the available context",
    "input length",
    "too many tokens",
)


class StructuredOutputError(ValueError):
    pass


# ollama -> lectura uniforme de respuestas (dict o modelo pydantic)
def _value(objeto: Any, clave: str, default: Any = None) -> Any:
    if objeto is None:
        return default
    if isinstance(objeto, Mapping):
        return objeto.get(clave, default)
    return getattr(objeto, clave, default)


# ollama -> normalizar nombres de modelos del servidor
def _model_names(response: Any) -> set[str]:
    nombres: set[str] = set()
    for item in _value(response, "models", []) or []:
        nombre = _value(item, "model") or _value(item, "name")
        if nombre:
            nombres.add(str(nombre))
    return nombres


# ollama -> coincidencia por nombre y por etiqueta
def _matching_tag(configured: str, installed: set[str]) -> str | None:
    if not configured:
        return None
    if configured in installed:
        return configured
    base = configured.split(":", 1)[0]
    for name in installed:
        if name.split(":", 1)[0] == base:
            return name
    return None


# ollama -> truncar contexto si excede la ventana del modelo
def _truncate_context(context: str, max_chars: int) -> str:
    if len(context) <= max_chars:
        return context
    # Mantener solo las primeras y ultimas partes, removiendo el medio
    keep_chars = max_chars // 2
    return context[:keep_chars] + "\n\n... [contexto truncado] ...\n\n" + context[-keep_chars:]


# ollama -> normalizar tiempo de permanencia
def _normalize_keep_alive(raw: Any) -> str | int:
    if raw is None:
        return "30m"
    if isinstance(raw, (int, float)):
        return int(raw)
    val = str(raw).strip().strip('"').strip("'")
    if val in ("-1", "-1s", "-1m", "-1h"):
        return -1
    return val or "30m"


# ollama -> cliente unico con salida estructurada y embeddings
class OllamaClient:
    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.timeout = httpx.Timeout(
            timeout=settings.llm_request_timeout,
            connect=settings.llm_connect_timeout,
        )
        self.keep_alive = _normalize_keep_alive(settings.ollama_keep_alive)
        self.client = AsyncClient(host=self.base_url, timeout=self.timeout)

    async def close(self) -> None:
        for nombre in ("aclose", "close"):
            cierre = getattr(self.client, nombre, None)
            if callable(cierre):
                await cierre()
                return
        interno = getattr(self.client, "_client", None)
        if interno is not None:
            await interno.aclose()

    # ollama -> modelos disponibles en el servidor
    async def installed_models(self) -> set[str]:
        try:
            return _model_names(await self.client.list())
        except Exception as exc:
            logger.warning("No se pudo listar los modelos de Ollama: %s", exc)
            return set()

    # ollama -> modelos configurados ausentes
    async def missing_models(self) -> list[str]:
        instalados = await self.installed_models()
        requeridos = (
            ("gemma", settings.ollama_gemma_model),
            ("mistral", settings.ollama_mistral_model),
            ("embedding", settings.ollama_embedding_model),
        )
        if not instalados:
            return [f"{clave}={modelo}" for clave, modelo in requeridos]
        return [f"{clave}={modelo}" for clave, modelo in requeridos if not _matching_tag(modelo, instalados)]

    # ollama -> servidor y modelos listos
    async def ready(self) -> bool:
        try:
            instalados = await self.installed_models()
        except Exception:
            return False
        if not instalados:
            return False
        return not await self.missing_models()

    # ollama -> precarga del modelo en memoria
    async def load_model(self, model: str) -> bool:
        try:
            await self.client.generate(
                model=model,
                prompt=" ",
                keep_alive=self.keep_alive,
                options={"num_predict": 1},
            )
            return True
        except Exception as exc:
            logger.warning("No se pudo precargar el modelo %s en Ollama: %s", model, exc)
            return False

    # ollama -> precarga de los tres modelos al arrancar
    async def preload_models(self) -> dict[str, bool]:
        resultados: dict[str, bool] = {
            "gemma": await self.load_model(settings.ollama_gemma_model),
            "mistral": await self.load_model(settings.ollama_mistral_model),
        }
        # ollama -> el modelo de embeddings no admite generate, se carga con embed
        try:
            await self.embed("inicio del indice academico RAG")
            resultados["embedding"] = True
        except Exception as exc:
            logger.warning("No se pudo precargar el modelo de embeddings en Ollama: %s", exc)
            resultados["embedding"] = False
        return resultados

    # ollama -> autoprueba de inferencia y embeddings
    async def startup_self_test(self) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for key, model in (("gemma", settings.ollama_gemma_model), ("mistral", settings.ollama_mistral_model)):
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": "Responde únicamente: OK"}],
                "options": {"num_predict": 8, "temperature": 0, "num_ctx": settings.ollama_num_ctx},
                "keep_alive": self.keep_alive,
            }
            try:
                response = await self.client.chat(**payload)
            except Exception as exc:
                logger.warning("Autoprueba de %s falló en Ollama: %s", key, exc)
                results[key] = False
                continue
            contenido = str(_value(_value(response, "message"), "content", "") or "")
            results[key] = "OK" in contenido.upper()
        try:
            results["embeddings"] = bool(await self.embed("prueba de inicio del indice academico RAG"))
        except Exception as exc:
            logger.warning("Autoprueba de embeddings falló en Ollama: %s", exc)
            results["embeddings"] = False
        return results

    # ollama -> opciones de muestreo y contexto por solicitud
    def _options(self, max_tokens: int, temperature: float, prompt_chars: int = 0) -> dict[str, Any]:
        prompt_estimate = int(prompt_chars / 2.6) + 256
        total_estimate = prompt_estimate + max_tokens + 256
        ventana = min(settings.ollama_num_ctx, max(2048, ((total_estimate + 255) // 256) * 256))
        return {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": ventana,
            "top_p": 0.9,
            "repeat_penalty": 1.05,
        }

    # ollama -> enviar chat tolerando servidores sin "think" o sin esquema
    async def _enviar_chat(self, payload: dict[str, Any]) -> Any:
        try:
            if settings.ollama_disable_thinking:
                return await self.client.chat(**payload, think=False)
            return await self.client.chat(**payload)
        except TypeError:
            # ollama -> version sin soporte de "think"
            return await self.client.chat(**payload)
        except ResponseError as exc:
            mensaje = str(_value(exc, "error", "") or exc)
            if "think" in mensaje.lower():
                logger.warning("Ollama no admite think=False; se reintenta sin ese parametro")
                return await self.client.chat(**payload)
            # ollama -> servidor sin salida estructurada por esquema
            if payload.get("format") not in (None, "json") and (
                "format" in mensaje.lower() or "schema" in mensaje.lower() or "json" in mensaje.lower()
            ):
                logger.warning("Ollama rechazó el esquema JSON; se reintenta con format=json")
                return await self.client.chat(**{**payload, "format": "json"})
            raise

    # ollama -> una llamada de chat con registro de consumo
    async def _chat_completion(
        self,
        model: str,
        prompt: str,
        schema: type[T] | None = None,
        max_tokens: int = 1600,
        temperature: float = 0.2,
    ) -> tuple[str, str | None, dict[str, Any], dict[str, Any]]:
        prompt_chars = len(prompt)
        total_estimate = prompt_chars + max_tokens + 256
        ventana_deseada = min(settings.ollama_num_ctx, max(2048, ((total_estimate + 255) // 256) * 256))

        if ventana_deseada > settings.ollama_num_ctx:
            prompt = _truncate_context(prompt, settings.ollama_num_ctx - max_tokens - 256)

        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": self._options(max_tokens, temperature, len(prompt)),
            "keep_alive": self.keep_alive,
        }
        if schema:
            payload["format"] = schema.model_json_schema()
        try:
            response = await self._enviar_chat(payload)
        except ResponseError as exc:
            detalle = str(_value(exc, "error", "") or exc)[:2000]
            logger.error("Ollama rechazó la solicitud model=%s detalle=%s", model, detalle)
            if any(marca in detalle.lower() for marca in CONTEXT_MARKERS):
                raise StructuredOutputError(
                    "Ollama rechazó la solicitud porque el contexto efectivo del modelo fue excedido. "
                    "Reduzca el contexto enviado o aumente OLLAMA_NUM_CTX."
                ) from exc
            raise StructuredOutputError(f"Ollama rechazó la solicitud: {detalle[:1000]}") from exc

        message = _value(response, "message", {})
        content = _value(message, "content", "") or ""
        if isinstance(content, list):
            content = "".join(str(_value(item, "text", "")) for item in content if item)
        finish_reason = _value(response, "done_reason") or ("length" if _value(response, "done") is False else "stop")
        prompt_tokens = _value(response, "prompt_eval_count", 0) or 0
        completion_tokens = _value(response, "eval_count", 0) or 0
        eval_duration = _value(response, "eval_duration", 0) or 0
        usage = {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens}
        stats = {
            "tokens_per_second": round(completion_tokens / (eval_duration / 1e9), 2) if eval_duration else "?",
            "total_duration_ms": round((_value(response, "total_duration", 0) or 0) / 1e6),
        }
        logger.info(
            "Ollama completó model=%s finish=%s prompt_tokens=%s completion_tokens=%s tokens_per_second=%s",
            model,
            finish_reason,
            prompt_tokens,
            completion_tokens,
            stats["tokens_per_second"],
        )
        if not content and _value(message, "thinking"):
            logger.warning("Ollama no devolvió texto final model=%s; solo contenido de razonamiento", model)
        return str(content), str(finish_reason), usage, stats

    # ollama -> salida estructurada validada con reintento correctivo
    async def structured(self, model: str, prompt_name: str, context: str, schema: type[T], max_tokens_override: int | None = None) -> T:
        prompt = (PROMPTS / prompt_name).read_text(encoding="utf-8")
        prompt = prompt.replace("{{context}}", context)
        errors = ""
        limite_base = max_tokens_override if max_tokens_override is not None else OUTPUT_LIMITS.get(schema.__name__, 1600)
        limite = limite_base
        max_attempts = 1 if schema.__name__ in SIN_REINTENTO else 3
        last_error = "respuesta vacía"
        for attempt in range(max_attempts):
            strict = "\nDevuelve únicamente JSON válido que cumpla exactamente el esquema solicitado. No uses Markdown."
            full_prompt = prompt + errors + (strict if attempt else "")
            prompt_chars = len(full_prompt)
            full_prompt_estimate = prompt_chars + limite + 256
            ventana = min(settings.ollama_num_ctx, max(2048, ((full_prompt_estimate + 255) // 256) * 256))
            logger.info(
                "Solicitando salida estructurada model=%s schema=%s prompt_chars=%s max_tokens=%s ctx_est=%s intento=%s",
                model,
                schema.__name__,
                prompt_chars,
                limite,
                ventana,
                attempt + 1,
            )
            raw, finish_reason, usage, _stats = await self._chat_completion(
                model=model,
                prompt=full_prompt,
                schema=schema,
                max_tokens=limite,
            )
            if finish_reason == "length":
                try:
                    completo = schema.model_validate_json(raw)
                except (ValidationError, ValueError):
                    completo = None
                if completo is not None:
                    logger.warning("Ollama alcanzó el límite de salida pero el JSON es válido model=%s schema=%s", model, schema.__name__)
                    return completo
                # Si es truncado y no parsea, intentar con mayor presupuesto si aún hay intentos
                if attempt < max_attempts - 1:
                    # Aumentar tokens con factor conservador para documentos grandes
                    limite = int(limite * 1.5) + 300
                    # Ajustar contexto para caber en ventana del modelo
                    limite = min(limite, settings.ollama_num_ctx - ventana + limite)
                    logger.warning(
                        "Salida truncada sin JSON válido para %s; aumentando max_tokens a %s e intentando nuevamente",
                        schema.__name__,
                        limite,
                    )
                    last_error = f"truncado sin JSON válido con num_predict={limite_base}"
                    continue
                raise StructuredOutputError(
                    f"La respuesta de {model} alcanzó num_predict={limite} "
                    f"(completion_tokens={usage.get('completion_tokens', '?')})"
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
                errors = f"\nLa salida anterior incumplio el esquema: {str(exc)[:400]}. Corrige el JSON completo.\n"
        raise StructuredOutputError(f"El modelo {model} no entregó una respuesta estructurada válida: {last_error}")

    # ollama -> embedding individual
    async def embed(self, text: str) -> list[float]:
        if not settings.ollama_embedding_model:
            raise RuntimeError("Configure OLLAMA_EMBEDDING_MODEL con un modelo ya descargado para habilitar RAG vectorial")
        try:
            response = await self.client.embed(
                model=settings.ollama_embedding_model,
                input=text,
                keep_alive=self.keep_alive,
            )
        except ResponseError as exc:
            raise ValueError(f"Ollama no pudo generar el embedding: {_value(exc, 'error', exc)}") from exc
        embeddings = _value(response, "embeddings", []) or []
        if not embeddings or not embeddings[0]:
            raise ValueError("Ollama no devolvió el embedding solicitado")
        return list(embeddings[0])

    # ollama -> embeddings por lote (una sola peticion)
    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        if not settings.ollama_embedding_model:
            raise RuntimeError("Configure OLLAMA_EMBEDDING_MODEL con un modelo ya descargado para habilitar RAG vectorial")
        if not texts:
            return []
        try:
            response = await self.client.embed(
                model=settings.ollama_embedding_model,
                input=texts,
                keep_alive=self.keep_alive,
            )
        except ResponseError as exc:
            raise ValueError(f"Ollama no pudo generar los embeddings: {_value(exc, 'error', exc)}") from exc
        embeddings = _value(response, "embeddings", []) or []
        if len(embeddings) != len(texts) or any(not item for item in embeddings):
            raise ValueError("Ollama no devolvió todos los embeddings solicitados")
        return [list(item) for item in embeddings]
