import asyncio
import json
import logging
import math
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Request

from app.config import settings
from app.lmstudio import LMStudioClient
from app.pipeline import _resumen_conceptual
from app.RAG.connection import create_redis_connection, create_notify_redis_connection
from app.RAG.repository import RAGRepository
from app.schemas import ContentCreatedEvent, ExplainSectionRequest, LearningSummaryRequest, MatchCheckRequest, QuizCompletedEvent, QuizRequest
from app.services.learning_summaries import generate_learning_summary
from app.services.quiz_service import issue_quiz
from app.services.student_learning import create_personalized_content, explain_section
from app.profile_worker import run_profile_worker
from app.worker import run_worker

logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    rag = RAGRepository(create_redis_connection())
    notify_redis = create_notify_redis_connection()
    llm = LMStudioClient()
    stop = asyncio.Event()
    semaphore = asyncio.Semaphore(max(1, settings.llm_max_concurrency))
    app.state.rag = rag
    app.state.notify_redis = notify_redis
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
                if not all(results.values()):
                    raise RuntimeError("Falló la autoprueba de inferencia o embeddings en LM Studio")
                app.state.llm_self_test = {"status": "passed", "models": results}
                logger.info("Autoprueba de modelos LM Studio completada")
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
        while not stop.is_set():
            try:
                await rag.initialize()
                logger.info("Estructura educativa RAG inicializada con contenido fuente")
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
        *(asyncio.create_task(run_worker(rag, llm, semaphore, stop, notify_redis)) for _ in range(max(1, settings.worker_count))),
        asyncio.create_task(run_profile_worker(rag, llm, semaphore, stop)),
    ]
    yield
    stop.set()
    for task in app.state.workers:
        task.cancel()
    await asyncio.gather(*app.state.workers, return_exceptions=True)
    await llm.close()
    await rag.close()
    await notify_redis.aclose()


app = FastAPI(title="Shalom serviceLLMs", version="0.1.0", lifespan=lifespan)


def require_internal_secret(presented: str | None) -> None:
    expected = settings.webhook_secret or "shalom-llm-dev"
    if presented is None or not __import__("hmac").compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="Token interno inválido")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "serviceLLMs"}


@app.get("/ready")
async def ready(request: Request):
    redis_ok = False
    vector_search_ok = False
    lmstudio_ok = False
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
        lmstudio_ok = await request.app.state.llm.ready()
    except Exception:
        logger.warning("LM Studio no disponible o modelos configurados no instalados")
    rag_initialized = False
    try:
        rag_initialized = await request.app.state.rag.is_initialized()
    except Exception:
        logger.warning("La estructura base del RAG aun no existe")
    self_test = request.app.state.llm_self_test
    self_test_ok = self_test.get("status") in {"passed", "skipped"}
    try:
        missing_models = await request.app.state.llm.missing_models()
    except Exception:
        missing_models = ["LM Studio no responde a /api/v1/models"]
    body = {"status": "ready" if redis_ok and vector_search_ok and lmstudio_ok and self_test_ok and rag_initialized else "degraded", "dependencies": {"redis": redis_ok, "redis_vector_search": vector_search_ok, "lmstudio_models": lmstudio_ok, "lmstudio_models_missing": missing_models, "lmstudio_inference_test": self_test, "rag_initialized": rag_initialized}}
    if not redis_ok or not vector_search_ok or not lmstudio_ok or not self_test_ok or not rag_initialized:
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
    if queued:
        estimated_minutes = max(2, min(12, 2 + math.ceil((event.document_size_bytes / (1024 * 1024)) * 1.5)))
        await request.app.state.rag.update_job(event.content_id, estimated_minutes=str(estimated_minutes))
        try:
            await request.app.state.notify_redis.publish("notificaciones:eventos", json.dumps({
                "eventType": "content.processing",
                "origen": "serviceLLMs",
                "payload": {"content_id": event.content_id, "document_id": event.document_id,
                            "document_name": event.document_name, "title": event.title,
                            "teacher_id": event.teacher_id, "assignment_id": event.assignment_id,
                            "grade": event.grade, "estimated_minutes": estimated_minutes},
                "emittedAt": event.timestamp,
            }, ensure_ascii=False))
        except Exception:
            logger.warning("No se pudo notificar el inicio del análisis content_id=%s", event.content_id, exc_info=True)
    return {"job_id": event.content_id, "status": "PENDING" if queued else "ALREADY_EXISTS", "queued": queued}


@app.get("/documents/{document_id}/learning")
async def document_learning(document_id: str, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    result = await request.app.state.rag.get_document_learning_content(document_id)
    if result is None:
        raise HTTPException(status_code=404, detail="El material todavía se está procesando")
    content = result["content"]
    content["summary"] = _resumen_conceptual(content.get("summary", ""), "", content.get("key_concepts", []))
    return {
        "content_id": result["content_id"],
        "title": content.get("title"),
        "summary": content.get("summary"),
        "subject": content.get("subject"),
        "topic_id": content.get("topic_id"),
        "learning_objectives": content.get("learning_objectives", []),
        "key_concepts": content.get("key_concepts", []),
        "microlearning_units": content.get("microlearning_units", []),
        "inquiry_questions": content.get("inquiry_questions", []),
        "difficulty": content.get("difficulty", "inicial"),
    }


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    result = await request.app.state.rag.job_status(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    return {"job_id": job_id, **result}


@app.get("/rag/search")
async def rag_search(q: str, request: Request, content_id: str | None = None, subject_id: str | None = None, grade: str | None = None, limit: int = 5, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    if not q.strip():
        raise HTTPException(status_code=400, detail="La consulta no puede estar vacía")
    try:
        vector = await request.app.state.llm.embed(q)
        filters = {key: value for key, value in {"content_id": content_id, "subject_id": subject_id, "grade": grade}.items() if value}
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
            event.elapsed_ms,
        )
        if not result.get("duplicate"):
            learning = [
                f"{'Dominado' if answer['correct'] else 'Reforzar'}: {answer['concept']} ({answer['difficulty']})."
                for answer in result.get("answers", [])
            ]
            interaction_text = "Progreso del estudiante en el contenido: " + " ".join(learning)
            try:
                async with request.app.state.semaphore:
                    embedding = await request.app.state.llm.embed(interaction_text)
                await request.app.state.rag.save_vector(
                    content_id=event.content_id,
                    chunk_id=f"student-{event.student_id}-attempt-{event.attempt_id}",
                    text=interaction_text,
                    embedding=embedding,
                    metadata={
                        "record_type": "student_interaction",
                        "branch": "students",
                        "student_id": event.student_id,
                        "attempt_id": event.attempt_id,
                        "score": str(result.get("score", 0)),
                        "source": "completed_quiz",
                    },
                )
            except Exception:
                logger.exception("No se pudo indexar el hito de aprendizaje student_id=%s content_id=%s", event.student_id, event.content_id)
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
        return await issue_quiz(student_id, content_id, body.activity_count, request.app.state.rag, request.app.state.llm, request.app.state.semaphore)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("No se pudo emitir el reto student_id=%s content_id=%s", student_id, content_id)
        raise HTTPException(status_code=503, detail="No se pudo preparar el reto; vuelve a intentarlo") from exc


@app.post("/students/{student_id}/contents/{content_id}/quizzes/{quiz_id}/check-match")
async def check_student_match(student_id: str, content_id: str, quiz_id: str, body: MatchCheckRequest, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        return await request.app.state.rag.check_match_pair(student_id, content_id, quiz_id, body.activity_id, body.left, body.right)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# main -> resumen avanzado del material validado
@app.post("/contents/{content_id}/summaries")
async def learning_summary(content_id: str, body: LearningSummaryRequest, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        if not await request.app.state.rag.get_validated_content(content_id):
            document_id = content_id.split("-", 1)[0]
            resolved = await request.app.state.rag.get_document_learning_content(document_id)
            if resolved:
                logger.warning("Resumen: se resolvio content_id=%s como %s", content_id, resolved["content_id"])
                content_id = resolved["content_id"]
        return await generate_learning_summary(content_id, body.formato, request.app.state.rag, request.app.state.llm, request.app.state.semaphore)
    except KeyError as exc:
        logger.exception("Clave faltante al recuperar evidencia del resumen content_id=%s", content_id)
        raise HTTPException(status_code=500, detail="No se pudo recuperar la evidencia RAG del material") from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("No se pudo generar el resumen avanzado content_id=%s", content_id)
        raise HTTPException(status_code=503, detail="El resumen avanzado no está disponible") from exc


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


@app.post("/students/{student_id}/contents/{content_id}/explain-section")
async def explain_student_section(student_id: str, content_id: str, body: ExplainSectionRequest, request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    try:
        return await explain_section(student_id, content_id, body, request.app.state.rag, request.app.state.llm, request.app.state.semaphore)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("No se pudo explicar la sección para el estudiante")
        raise HTTPException(status_code=503, detail="La explicación no está disponible") from exc
