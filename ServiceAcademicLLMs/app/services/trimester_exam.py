from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.config import settings
from app.ollama_client import OllamaClient
from app.RAG.repository import RAGRepository

logger = logging.getLogger(__name__)


class TrimesterTopicInput(BaseModel):
    material_id: str
    titulo: str = ""
    tema_nombre: str = ""


class TrimesterExamPair(BaseModel):
    izquierda: str = ""
    derecha: str = ""


class TrimesterExamQuestion(BaseModel):
    numero: int = Field(ge=1)
    categoria: Literal["TEORICA", "PRACTICA"] = "TEORICA"
    formato: Literal[
        "SELECCION_MULTIPLE",
        "COMPLETAR",
        "CONECTAR_FRASES",
        "DRAG_AND_DROP",
        "RESOLVER_EJERCICIO",
    ] = "SELECCION_MULTIPLE"
    tema: str = ""
    enunciado_md: str = Field(min_length=5)
    opciones: list[str] = Field(default_factory=list)
    pares: list[TrimesterExamPair] = Field(default_factory=list)
    items: list[str] = Field(default_factory=list)
    respuesta_correcta_md: str = ""
    criterio_evaluacion_md: str = ""
    puntaje: float = 5.0


class TrimesterExamBatchOutput(BaseModel):
    preguntas: list[TrimesterExamQuestion] = Field(default_factory=list)


class TrimesterExamGenerateRequest(BaseModel):
    exam_id: str = ""
    titulo: str = ""
    materia: str = "Materia"
    curso: str = ""
    grado: str = ""
    nivel: str = "Secundaria"
    trimestre_numero: int = 1
    dificultad: Literal["Alto", "Medio", "Moderado"] = "Medio"
    cantidad_preguntas: Literal[10, 15, 20] = 10
    cantidad_teoricas: int = Field(ge=0, le=20)
    cantidad_practicas: int = Field(ge=0, le=20)
    temas: list[TrimesterTopicInput] = Field(min_length=1)


class TrimesterExamRegenerateRequest(BaseModel):
    exam_id: str = ""
    materia: str = "Materia"
    curso: str = ""
    grado: str = ""
    nivel: str = "Secundaria"
    trimestre_numero: int = 1
    dificultad: Literal["Alto", "Medio", "Moderado"] = "Medio"
    pregunta_actual: dict[str, Any]
    indicaciones_docente: str = Field(min_length=3)
    temas: list[TrimesterTopicInput] = Field(default_factory=list)


class TrimesterExamRagTopicsRequest(BaseModel):
    temas: list[TrimesterTopicInput] = Field(default_factory=list)


async def inspect_rag_topics(
    repo: RAGRepository,
    temas: list[TrimesterTopicInput],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for tema in temas:
        doc = await repo.get_document_learning_content(str(tema.material_id))
        if doc:
            raw_content = doc.get("content") or {}
            refined = doc.get("refined_content") or raw_content.get("refined_content") or raw_content
            units = refined.get("microlearning_units") or []
            concepts = refined.get("key_concepts") or []
            results.append({
                "material_id": str(tema.material_id),
                "rag_disponible": True,
                "titulo_rag": str(refined.get("title") or tema.titulo or tema.tema_nombre or "Tema"),
                "resumen": str(refined.get("summary") or "")[:240],
                "conceptos_clave": [str(c) for c in concepts[:5]],
                "unidades_count": len(units),
            })
        else:
            results.append({
                "material_id": str(tema.material_id),
                "rag_disponible": False,
                "titulo_rag": str(tema.titulo or tema.tema_nombre or "Tema"),
                "resumen": "",
                "conceptos_clave": [],
                "unidades_count": 0,
            })
    return results


async def _collect_rag_evidence(
    repo: RAGRepository,
    temas: list[TrimesterTopicInput],
) -> list[dict[str, Any]]:
    evidencia: list[dict[str, Any]] = []
    for tema in temas:
        doc = await repo.get_document_learning_content(str(tema.material_id))
        if not doc:
            evidencia.append({
                "material_id": str(tema.material_id),
                "titulo": tema.titulo or tema.tema_nombre or "Tema",
                "resumen": "",
                "conceptos": [],
                "unidades": [],
                "ejemplos_banco": [],
            })
            continue
        raw_content = doc.get("content") or {}
        refined = doc.get("refined_content") or raw_content.get("refined_content") or raw_content
        content_id = str(doc.get("content_id") or "")
        bank = await repo.get_activity_bank(content_id) if content_id else []
        unidades = []
        for u in (refined.get("microlearning_units") or [])[:5]:
            if isinstance(u, dict):
                unidades.append({
                    "titulo": str(u.get("title") or ""),
                    "explicacion": str(u.get("explanation") or "")[:360],
                    "ejemplo": str(u.get("examples_blackboard") or "")[:360],
                })
        ejemplos_banco = []
        for act in bank[:6]:
            if isinstance(act, dict):
                ejemplos_banco.append({
                    "formato": str(act.get("type") or act.get("tipo") or ""),
                    "pregunta": str(act.get("question") or "")[:240],
                })
        evidencia.append({
            "material_id": str(tema.material_id),
            "titulo": str(refined.get("title") or tema.titulo or tema.tema_nombre or "Tema"),
            "resumen": str(refined.get("summary") or "")[:500],
            "objetivos": [str(o) for o in (refined.get("learning_objectives") or [])[:4]],
            "conceptos": [str(c) for c in (refined.get("key_concepts") or [])[:6]],
            "unidades": unidades,
            "ejemplos_banco": ejemplos_banco,
        })
    return evidencia


async def generate_trimester_exam(
    repo: RAGRepository,
    llm: OllamaClient,
    semaphore: asyncio.Semaphore,
    req: TrimesterExamGenerateRequest,
) -> list[dict[str, Any]]:
    exam_ref = str(req.exam_id or "").strip() or f"tmp-{int(datetime.now().timestamp())}"
    job_id = f"exam-{exam_ref}"
    total = int(req.cantidad_preguntas)
    teoricas_restantes = int(req.cantidad_teoricas)
    practicas_restantes = int(req.cantidad_practicas)
    puntaje_por_pregunta = round(100.0 / total, 2)

    # Dividir en lotes de 5 preguntas para evitar truncamiento y maximizar calidad Markdown
    batch_size = 5
    lotes: list[tuple[int, int, int, int]] = []
    num_inicio = 1
    while num_inicio <= total:
        size = min(batch_size, total - num_inicio + 1)
        t_batch = min(teoricas_restantes, round(size * (teoricas_restantes / max(1, teoricas_restantes + practicas_restantes))))
        p_batch = size - t_batch
        if p_batch > practicas_restantes:
            p_batch = practicas_restantes
            t_batch = size - p_batch
        teoricas_restantes -= t_batch
        practicas_restantes -= p_batch
        lotes.append((num_inicio, size, t_batch, p_batch))
        num_inicio += size

    total_batches = len(lotes)
    await repo.update_job(
        job_id,
        status="STARTED",
        job_type="trimester_exam",
        exam_id=exam_ref,
        titulo=req.titulo or f"Evaluación Trimestral T{req.trimestre_numero} - {req.materia}",
        materia=req.materia,
        curso=req.curso,
        grado=req.grado,
        nivel=req.nivel,
        trimestre=str(req.trimestre_numero),
        dificultad=req.dificultad,
        progress="5",
        stage="Recolectando evidencia de temas y materiales en RAG",
        total_questions=str(total),
        generated_questions="0",
        total_batches=str(total_batches),
        current_batch="0",
        error="",
    )

    try:
        evidencia = await _collect_rag_evidence(repo, req.temas)
        await repo.update_job(
            job_id,
            status="EVIDENCE_READY",
            progress="15",
            stage=f"Evidencia preparada ({len(evidencia)} tema(s)); iniciando generación de preguntas",
        )

        preguntas_finales: list[dict[str, Any]] = []
        temas_cubiertos_previos: list[str] = []
        formatos_teoricos = ["SELECCION_MULTIPLE", "COMPLETAR", "CONECTAR_FRASES", "DRAG_AND_DROP"]
        formatos_practicos = ["RESOLVER_EJERCICIO", "DRAG_AND_DROP", "COMPLETAR", "SELECCION_MULTIPLE", "CONECTAR_FRASES"]
        idx_teorico = 0
        idx_practico = 0

        for batch_index, (inicio, size, t_batch, p_batch) in enumerate(lotes, start=1):
            formatos_lote: list[dict[str, Any]] = []
            for offset in range(t_batch):
                formatos_lote.append({
                    "numero": inicio + len(formatos_lote),
                    "categoria": "TEORICA",
                    "formato": formatos_teoricos[idx_teorico % len(formatos_teoricos)],
                })
                idx_teorico += 1
            for offset in range(p_batch):
                formatos_lote.append({
                    "numero": inicio + len(formatos_lote),
                    "categoria": "PRACTICA",
                    "formato": formatos_practicos[idx_practico % len(formatos_practicos)],
                })
                idx_practico += 1

            start_pct = 15 + int(((batch_index - 1) / max(1, total_batches)) * 75)
            await repo.update_job(
                job_id,
                status="GENERATING_QUESTIONS",
                progress=str(start_pct),
                current_batch=str(batch_index),
                total_batches=str(total_batches),
                generated_questions=str(len(preguntas_finales)),
                stage=f"Generando lote {batch_index}/{total_batches} (preguntas {inicio} a {inicio + size - 1})",
            )

            context = json.dumps({
                "materia": req.materia,
                "curso": req.curso,
                "nivel": req.nivel,
                "trimestre": req.trimestre_numero,
                "dificultad": req.dificultad,
                "numero_inicio": inicio,
                "cantidad_lote": size,
                "cantidad_teoricas": t_batch,
                "cantidad_practicas": p_batch,
                "formatos_requeridos_lote": formatos_lote,
                "puntaje_sugerido": puntaje_por_pregunta,
                "evitar_repetir_enunciados": temas_cubiertos_previos[-10:],
                "evidencia_rag_temas": evidencia,
            }, ensure_ascii=False)

            async with semaphore:
                batch_out = await llm.structured(
                    settings.ollama_gemma_model,
                    "gemma/trimester_exam.txt",
                    context,
                    TrimesterExamBatchOutput,
                    max_tokens_override=3400,
                )

            for idx, q in enumerate(batch_out.preguntas[:size]):
                numero_real = inicio + idx
                data = q.model_dump()
                data["id"] = f"q-{numero_real}"
                data["numero"] = numero_real
                data["puntaje"] = puntaje_por_pregunta
                data["estado"] = "pendiente"
                data["comentario"] = ""
                preguntas_finales.append(data)
                temas_cubiertos_previos.append(str(data.get("enunciado_md", ""))[:90])

            end_pct = 15 + int((batch_index / max(1, total_batches)) * 75)
            await repo.update_job(
                job_id,
                status="GENERATING_QUESTIONS",
                progress=str(end_pct),
                current_batch=str(batch_index),
                generated_questions=str(len(preguntas_finales)),
                stage=f"Lote {batch_index}/{total_batches} completado ({len(preguntas_finales)}/{total} preguntas)",
            )

        # Asegurar numeración secuencial exacta
        for idx, item in enumerate(preguntas_finales, start=1):
            item["numero"] = idx
            item["id"] = f"q-{idx}"

        await repo.update_job(
            job_id,
            status="SAVING_EXAM_RAG",
            progress="94",
            generated_questions=str(len(preguntas_finales)),
            stage="Guardando evaluación en RAG (examn)",
        )

        rag_key = await repo.save_trimester_exam(
            exam_id=exam_ref,
            nivel=req.nivel,
            grado=req.grado,
            curso=req.curso,
            trimestre_numero=req.trimestre_numero,
            dificultad=req.dificultad,
            payload={
                "job_id": job_id,
                "titulo": req.titulo or f"Evaluación Trimestral T{req.trimestre_numero} - {req.materia}",
                "materia": req.materia,
                "curso": req.curso,
                "grado": req.grado,
                "nivel": req.nivel,
                "trimestre_numero": req.trimestre_numero,
                "dificultad": req.dificultad,
                "cantidad_preguntas": req.cantidad_preguntas,
                "cantidad_teoricas": req.cantidad_teoricas,
                "cantidad_practicas": req.cantidad_practicas,
                "temas": [t.model_dump() for t in req.temas],
                "preguntas": preguntas_finales,
            },
        )

        await repo.update_job(
            job_id,
            status="COMPLETED",
            progress="100",
            generated_questions=str(len(preguntas_finales)),
            exam_rag_key=rag_key,
            stage="Evaluación trimestral generada y almacenada en RAG",
            error="",
        )

        return preguntas_finales
    except Exception as exc:
        await repo.update_job(
            job_id,
            status="FAILED",
            stage="Error durante la generación de preguntas",
            error=str(exc)[:1000],
        )
        raise


async def regenerate_trimester_question(
    repo: RAGRepository,
    llm: OllamaClient,
    semaphore: asyncio.Semaphore,
    req: TrimesterExamRegenerateRequest,
) -> dict[str, Any]:
    evidencia = await _collect_rag_evidence(repo, req.temas)
    context = json.dumps({
        "materia": req.materia,
        "curso": req.curso,
        "nivel": req.nivel,
        "dificultad": req.dificultad,
        "pregunta_actual": req.pregunta_actual,
        "indicaciones_docente": req.indicaciones_docente,
        "evidencia_rag_temas": evidencia,
    }, ensure_ascii=False)

    async with semaphore:
        updated = await llm.structured(
            settings.ollama_gemma_model,
            "gemma/regenerate_exam_question.txt",
            context,
            TrimesterExamQuestion,
            max_tokens_override=1400,
        )

    data = updated.model_dump()
    data["id"] = str(req.pregunta_actual.get("id") or f"q-{updated.numero}")
    data["numero"] = int(req.pregunta_actual.get("numero") or updated.numero)
    data["puntaje"] = float(req.pregunta_actual.get("puntaje") or updated.puntaje or 5.0)
    data["estado"] = "pendiente"
    data["comentario"] = ""
    return data
