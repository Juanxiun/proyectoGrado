import asyncio
import logging
from fastapi import APIRouter, Header, HTTPException, Request, Response
from app.routers.security import require_internal_secret
from app.services.trimester_exam import (
    TrimesterExamCompilePdfRequest,
    TrimesterExamGenerateRequest,
    TrimesterExamRagTopicsRequest,
    TrimesterExamRegenerateRequest,
    compile_trimester_exam_pdf,
    generate_trimester_exam,
    inspect_rag_topics,
    regenerate_trimester_question,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trimester-exams", tags=["trimester-exams"])


# LLM -> consulta de temas indexados en RAG
@router.post("/rag-topics")
async def trimester_exam_rag_topics(
    payload: TrimesterExamRagTopicsRequest,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    temas = await inspect_rag_topics(request.app.state.rag, payload.temas)
    return {"temas": temas}


# LLM -> generacion sincrona de examen trimestral
@router.post("/generate")
async def trimester_exam_generate(
    payload: TrimesterExamGenerateRequest,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    if payload.cantidad_teoricas + payload.cantidad_practicas != payload.cantidad_preguntas:
        raise HTTPException(status_code=400, detail="La suma de preguntas teóricas y prácticas debe coincidir con el total.")
    try:
        preguntas = await generate_trimester_exam(
            request.app.state.rag, request.app.state.llm, request.app.state.semaphore, payload
        )
        return {"preguntas": preguntas}
    except Exception as exc:
        logger.exception("Error generando evaluación trimestral")
        raise HTTPException(status_code=500, detail="No se pudo generar la evaluación trimestral.") from exc


# LLM -> generacion asincrona en segundo plano con tracking en Redis
@router.post("/generate-async")
async def trimester_exam_generate_async(
    payload: TrimesterExamGenerateRequest,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    if payload.cantidad_teoricas + payload.cantidad_practicas != payload.cantidad_preguntas:
        raise HTTPException(status_code=400, detail="La suma de preguntas teóricas y prácticas debe coincidir con el total.")

    app_state = request.app.state
    exam_ref = str(payload.exam_id or "").strip() or f"tmp-{int(asyncio.get_running_loop().time())}"
    job_id = f"exam-{exam_ref}"
    await app_state.rag.update_job(
        job_id,
        status="STARTED",
        job_type="trimester_exam",
        exam_id=exam_ref,
        titulo=payload.titulo or f"Evaluación Trimestral T{payload.trimestre_numero} - {payload.materia}",
        materia=payload.materia,
        curso=payload.curso,
        grado=payload.grado,
        nivel=payload.nivel,
        trimestre=str(payload.trimestre_numero),
        dificultad=payload.dificultad,
        progress="5",
        stage="En cola para generación de preguntas",
        total_questions=str(payload.cantidad_preguntas),
        generated_questions="0",
        error="",
    )

    async def _run() -> None:
        try:
            await generate_trimester_exam(app_state.rag, app_state.llm, app_state.semaphore, payload)
        except Exception:
            logger.exception("Error en tarea asíncrona de evaluación trimestral %s", exam_ref)

    task = asyncio.create_task(_run())
    if not hasattr(app_state, "exam_tasks"):
        app_state.exam_tasks = set()
    app_state.exam_tasks.add(task)
    task.add_done_callback(app_state.exam_tasks.discard)

    return {"job_id": job_id, "exam_id": exam_ref, "status": "STARTED"}


@router.post("/regenerate-question")
async def trimester_exam_regenerate_question(
    payload: TrimesterExamRegenerateRequest,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    try:
        pregunta = await regenerate_trimester_question(
            request.app.state.rag, request.app.state.llm, request.app.state.semaphore, payload
        )
        return {"pregunta": pregunta}
    except Exception as exc:
        logger.exception("Error regenerando pregunta de evaluación trimestral")
        raise HTTPException(status_code=500, detail="No se pudo regenerar la pregunta solicitada.") from exc


@router.get("/jobs/{job_id}")
async def trimester_exam_job_status(
    job_id: str,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    status = await request.app.state.rag.job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job de evaluación trimestral no encontrado.")
    return status


@router.get("/rag")
async def trimester_exam_rag_list(
    request: Request,
    nivel: str | None = None,
    grado: str | None = None,
    trimestre_numero: int | None = None,
    dificultad: str | None = None,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    items = await request.app.state.rag.list_trimester_exams(
        nivel=nivel,
        grado=grado,
        trimestre_numero=trimestre_numero,
        dificultad=dificultad,
    )
    return {"data": items}


@router.get("/rag/by-id/{exam_id}")
async def trimester_exam_rag_by_id(
    exam_id: str,
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    item = await request.app.state.rag.get_trimester_exam_by_id(exam_id)
    if not item:
        raise HTTPException(status_code=404, detail="Evaluación trimestral no encontrada en RAG.")
    return item


# LLM -> compilacion rapida de examen a PDF
@router.post("/compile-pdf")
async def trimester_exam_compile_pdf(
    payload: TrimesterExamCompilePdfRequest,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    if not payload.preguntas:
        raise HTTPException(status_code=400, detail="No hay preguntas para compilar el PDF.")
    try:
        pdf_bytes = compile_trimester_exam_pdf(payload)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'inline; filename="evaluacion_trimestral.pdf"'},
        )
    except Exception as exc:
        logger.exception("Error compilando PDF de evaluación trimestral")
        raise HTTPException(status_code=500, detail="No se pudo compilar el documento PDF.") from exc
