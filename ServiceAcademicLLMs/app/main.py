import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.connection import create_redis_connection
from app.RAG.repository import RAGRepository
from app.schemas import ContentCreatedEvent, QuizCompletedEvent, QuizRequest
from app.services.quiz_service import issue_quiz
from app.services.student_learning import create_personalized_content
from app.profile_worker import run_profile_worker
from app.worker import run_worker

logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    rag = RAGRepository(create_redis_connection())
    llm = OllamaClient()
    stop = asyncio.Event()
    semaphore = asyncio.Semaphore(max(1, settings.llm_max_concurrency))
    prompts_path = Path(__file__).resolve().parent.parent / "prompts"
    prompt_documents = {
        "base_knowledge": (prompts_path / "rag/base_knowledge.txt").read_text(encoding="utf-8"),
        "microlearning": (prompts_path / "microlearning.txt").read_text(encoding="utf-8"),
        "inquiry_based_learning": (prompts_path / "inquiry_based_learning.txt").read_text(encoding="utf-8"),
    }
    app.state.rag = rag
    app.state.llm = llm
    app.state.semaphore = semaphore
    app.state.llm_self_test = {"status": "pending", "models": {}}

    async def test_llms_on_start() -> None:
        while not stop.is_set():
            try:
                missing = await llm.missing_models()
                if missing:
                    raise RuntimeError("Modelos/tags requeridos no instalados o mal configurados: " + ", ".join(missing))
                results = await llm.startup_self_test()
                app.state.llm_self_test = {"status": "passed" if all(results.values()) else "failed", "models": results}
                logger.info("Autoprueba de Ollama al iniciar: %s", app.state.llm_self_test)
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                app.state.llm_self_test = {"status": "failed", "models": {}, "error": str(exc)[:500]}
                logger.warning("Autoprueba LLM no disponible; se reintentará: %s", exc)
                try:
                    await asyncio.wait_for(stop.wait(), timeout=30)
                except TimeoutError:
                    pass

    async def bootstrap_rag() -> None:
        framework_docs = {key: value for key, value in prompt_documents.items() if key != "base_knowledge"}
        while not stop.is_set():
            try:
                await rag.initialize(prompt_documents)
                if await rag.bootstrap_frameworks(framework_docs, llm.embed):
                    logger.info("Esquema RAG y marcos pedagogicos inicializados")
                    return
            except Exception:
                logger.warning("Redis RAG aun no disponible; se reintentara el bootstrap", exc_info=True)
            try:
                await asyncio.wait_for(stop.wait(), timeout=30)
            except TimeoutError:
                pass

    app.state.workers = [
        asyncio.create_task(test_llms_on_start()),
        asyncio.create_task(bootstrap_rag()),
        *(asyncio.create_task(run_worker(rag, llm, semaphore, stop)) for _ in range(max(1, settings.worker_count))),
        asyncio.create_task(run_profile_worker(rag, llm, semaphore, stop)),
    ]
    yield
    stop.set()
    for task in app.state.workers:
        task.cancel()
    await asyncio.gather(*app.state.workers, return_exceptions=True)
    await llm.close()
    await rag.close()


app = FastAPI(title="Shalom serviceLLMs", version="0.1.0", lifespan=lifespan)


def require_internal_secret(presented: str | None) -> None:
    if not settings.webhook_secret or presented is None or not __import__("hmac").compare_digest(presented, settings.webhook_secret):
        raise HTTPException(status_code=401, detail="Token interno inválido")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "serviceLLMs"}


@app.get("/ready")
async def ready(request: Request):
    redis_ok = False
    vector_search_ok = False
    ollama_ok = False
    try:
        redis_ok = await request.app.state.rag.ping()
    except Exception:
        logger.warning("Redis RAG no disponible")
    if redis_ok:
        try:
            vector_search_ok = await request.app.state.rag.vector_search_available()
        except Exception:
            logger.warning("Redis Search/Vector no disponible")
    try:
        ollama_ok = await request.app.state.llm.ready()
    except Exception:
        logger.warning("Ollama no disponible o modelos configurados no instalados")
    rag_initialized = False
    try:
        rag_initialized = await request.app.state.rag.is_initialized()
    except Exception:
        logger.warning("La estructura base del RAG aun no existe")
    self_test = request.app.state.llm_self_test
    self_test_ok = self_test.get("status") == "passed"
    try:
        missing_models = await request.app.state.llm.missing_models()
    except Exception:
        missing_models = ["Ollama no responde a list()"]
    body = {"status": "ready" if redis_ok and vector_search_ok and ollama_ok and self_test_ok and rag_initialized else "degraded", "dependencies": {"redis": redis_ok, "redis_vector_search": vector_search_ok, "ollama_models": ollama_ok, "ollama_models_missing": missing_models, "ollama_inference_test": self_test, "rag_initialized": rag_initialized}}
    if not redis_ok or not vector_search_ok or not ollama_ok or not self_test_ok or not rag_initialized:
        raise HTTPException(status_code=503, detail=body)
    return body


@app.get("/rag/structure")
async def rag_structure(request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    return await request.app.state.rag.structure_overview()


@app.post("/webhooks/content-created", status_code=202)
async def content_created(event: ContentCreatedEvent, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        queued = await request.app.state.rag.enqueue_content(event.content_id, event.model_dump(mode="json"))
    except Exception as exc:
        logger.exception("No se pudo registrar el webhook content_id=%s", event.content_id)
        raise HTTPException(status_code=503, detail="La cola LLM no está disponible") from exc
    return {"job_id": event.content_id, "status": "PENDING" if queued else "ALREADY_EXISTS", "queued": queued}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    result = await request.app.state.rag.job_status(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    return {"job_id": job_id, **result}


@app.get("/rag/search")
async def rag_search(q: str, request: Request, content_id: str | None = None, subject_id: str | None = None, limit: int = 5, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    if not q.strip():
        raise HTTPException(status_code=400, detail="La consulta no puede estar vacía")
    try:
        vector = await request.app.state.llm.embed(q)
        filters = {key: value for key, value in {"content_id": content_id, "subject_id": subject_id}.items() if value}
        results = await request.app.state.rag.vector_search(vector, min(max(limit, 1), 20), filters or None)
        return {"results": results}
    except Exception as exc:
        logger.exception("La búsqueda RAG falló")
        raise HTTPException(status_code=503, detail="La búsqueda RAG no está disponible") from exc


@app.post("/webhooks/quiz-completed", status_code=202)
async def quiz_completed(event: QuizCompletedEvent, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        result = await request.app.state.rag.record_quiz_attempt(
            event.student_id, event.content_id, event.attempt_id,
            [answer.model_dump() for answer in event.answers],
        )
        return {"status": "recorded", **result}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/students/{student_id}/contents/{content_id}/quizzes")
async def create_student_quiz(student_id: str, content_id: str, body: QuizRequest, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    if body.student_id != student_id or body.content_id != content_id:
        raise HTTPException(status_code=400, detail="Los IDs del cuerpo deben coincidir con la ruta")
    try:
        return await issue_quiz(student_id, content_id, body.question_count, request.app.state.rag, request.app.state.llm, request.app.state.semaphore)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/students/{student_id}/profiles/{content_id}")
async def get_student_profile(student_id: str, content_id: str, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    profile = await request.app.state.rag.get_student_profile(student_id, content_id)
    if not profile:
        raise HTTPException(status_code=404, detail="El perfil se genera al completar cuatro cuestionarios")
    return profile


@app.post("/students/{student_id}/contents/{content_id}/personalized")
async def personalized_content(student_id: str, content_id: str, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        return await create_personalized_content(
            student_id, content_id, request.app.state.rag,
            request.app.state.llm, request.app.state.semaphore,
        )
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("No se pudo crear contenido personalizado")
        raise HTTPException(status_code=503, detail="El contenido personalizado no está disponible") from exc
