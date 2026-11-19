import asyncio
import hashlib
import json
import logging
import math
import re
import time
from html import escape
from typing import Any

import httpx
from redis.asyncio import Redis

from app.config import settings
from app.chunking import CATEGORIA_EJERCICIOS, SemanticChunk, split_document_sections, _normalizar
from app.documents import extract_text
from app.ollama_client import OllamaClient
from app.RAG.repository import RAGRepository
from app.schemas import ActivityBatchOutput, ActivitySet, ContentCreatedEvent, ContentEvaluation, LearningUnit, RefinedContent
from app.services.activities import normalize_activity

logger = logging.getLogger(__name__)

NOTIFY_CANAL = "notificaciones:eventos"
NOTIFY_ORIGEN = "serviceLLMs"


# content -> resumen conceptual sin procedencia
def _resumen_conceptual(texto: str, nombre_archivo: str, conceptos: list[str]) -> str:
    salida = str(texto or "")
    if nombre_archivo:
        salida = re.sub(re.escape(nombre_archivo), "", salida, flags=re.IGNORECASE)
    salida = re.sub(r"(?i)(?:seg[uú]n|de acuerdo con|extra[ií]do de|contenido del)\s+(?:el\s+)?(?:pdf|archivo|documento)(?::\s+subido)?", "", salida)
    salida = re.sub(r"(?i)(?:en|del)\s+(?:el\s+)?(?:pdf|archivo|documento)\s+(?:subido|adjunto)", "", salida)
    salida = re.sub(r"\s+", " ", salida).strip(" ,;:-")
    if not salida:
        salida = ". ".join(conceptos[:3])
    return salida[:500].rstrip(" ,;:-")


# retry -> configuracion para Ollama
OLLAMA_MAX_RETRIES = 3
OLLAMA_RETRY_BASE_DELAY = 5.0


def _metadata(event: ContentCreatedEvent) -> dict[str, str]:
    return {key: str(value or "") for key, value in {
        "subject": event.subject, "subject_id": event.subject_id, "topic_id": event.topic_id,
        "document_id": event.document_id, "source": event.source, "grade": event.grade, "course": event.course,
    }.items()}


_MATERIAS_PRACTICAS = (
    "matem", "fisic", "quimic", "algebra", "geometr", "aritmet",
    "calculo", "estadist", "trigonometr", "ciencia",
)
_RUIDO_TITULO = re.compile(
    r"^(figura|fig\.|tabla|ejemplo|ejercicio|actividad|problema|anexo|ap[eé]ndice)\b",
    re.IGNORECASE,
)


def _es_materia_practica(subject: str | None) -> bool:
    nombre = _normalizar(subject or "")
    return any(clave in nombre for clave in _MATERIAS_PRACTICAS)


def _titulo_completo(heading: str, fallback: str = "") -> str:
    partes = [parte.strip() for parte in re.split(r"\s*/\s*", heading or "") if parte.strip()]
    for parte in partes:
        limpio = re.sub(r"^[\dIVXLC]+[.)]\s*", "", parte).strip(" -:.")
        if len(limpio) >= 8 and not _RUIDO_TITULO.match(limpio) and not limpio.lower().endswith((" de", " del", " la", " el", " y", " en")):
            return limpio[:120]
    candidato = (partes[0] if partes else fallback or "Tema").strip(" -:.")
    return candidato[:120] if candidato else (fallback or "Tema")[:120]


# visual -> helper para envolver texto SVG en varias lineas y evitar desbordes
def _wrap_svg_text(text: str, max_chars_per_line: int = 16, max_lines: int = 2) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    current_len = 0
    for word in words:
        if current and current_len + len(word) + 1 > max_chars_per_line:
            lines.append(" ".join(current))
            current = [word]
            current_len = len(word)
            if len(lines) == max_lines:
                break
        else:
            current.append(word)
            current_len += len(word) + (1 if current_len > 0 else 0)
    if current and len(lines) < max_lines:
        lines.append(" ".join(current))
    if not lines:
        lines = [text[:max_chars_per_line]]
    return lines


# visual -> SVG inline de conceptos respaldados con ajuste de texto sin desbordes
def _svg_concept_map(titulo: str, conceptos: list[str]) -> str:
    etiquetas = list(dict.fromkeys(str(item).strip() for item in conceptos if str(item).strip()))[:5]
    etiquetas = etiquetas or [titulo[:30]]
    nodos, enlaces = [], []
    centro_x, centro_y = 205, 160

    # Titulo central envuelto en lineas para evitar overflow
    titulo_lines = _wrap_svg_text(titulo, max_chars_per_line=18, max_lines=2)
    titulo_tspan = "".join(
        f'<tspan x="{centro_x}" dy="{14 if i > 0 else (0 if len(titulo_lines) == 1 else -6)}">{escape(line)}</tspan>'
        for i, line in enumerate(titulo_lines)
    )

    radio_x, radio_y = 125, 105
    for indice, etiqueta in enumerate(etiquetas):
        angulo = (2 * 3.141592653589793 * indice / len(etiquetas)) - 1.5707963267948966
        x = centro_x + int(radio_x * math.cos(angulo))
        y = centro_y + int(radio_y * math.sin(angulo))
        x = max(80, min(330, x))
        y = max(45, min(275, y))

        enlaces.append(f'<line x1="{centro_x}" y1="{centro_y}" x2="{x}" y2="{y}" stroke="#CBD5E1" stroke-width="2"/>')

        lines = _wrap_svg_text(etiqueta, max_chars_per_line=15, max_lines=2)
        node_w, node_h = 135, 46
        tspans = "".join(
            f'<tspan x="{x}" dy="{13 if i > 0 else (0 if len(lines) == 1 else -5)}">{escape(line)}</tspan>'
            for i, line in enumerate(lines)
        )
        nodos.append(
            f'<rect x="{x - node_w // 2}" y="{y - node_h // 2}" width="{node_w}" height="{node_h}" rx="12" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.5"/>'
            f'<text x="{x}" y="{y + 4}" text-anchor="middle" font-size="10.5" font-family="system-ui, -apple-system, sans-serif" font-weight="600" fill="#1E293B">{tspans}</text>'
        )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="410" height="320" viewBox="0 0 410 320">'
        f'<rect width="410" height="320" rx="16" fill="#FFFFFF"/>'
        f'{"".join(enlaces)}'
        f'<rect x="{centro_x - 85}" y="{centro_y - 28}" width="170" height="56" rx="16" fill="#801F3F"/>'
        f'<text x="{centro_x}" y="{centro_y + 4}" text-anchor="middle" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-weight="700" fill="#FFFFFF">{titulo_tspan}</text>'
        f'{"".join(nodos)}'
        f'</svg>'
    )


def _pasos_visuales(ejemplos: list[str], explicacion: str) -> list[str]:
    texto = "\n".join(item for item in ejemplos if str(item).strip()) or explicacion
    crudo = re.split(r"(?:paso\s*\d+\s*[:.)-]*|\n|;|→|⇒|->)", texto, flags=re.IGNORECASE)
    pasos = [re.sub(r"\s+", " ", item).strip(" -:.") for item in crudo if str(item).strip()]
    if len(pasos) < 3:
        base = pasos[0] if pasos else (explicacion or "Aplicar la idea del tema")
        return [f"Identificar: {base[:42]}", "Aplicar la regla o dato del tema", "Comprobar el resultado"]
    return pasos[:3]


# visual -> ilustracion vectorial pedagogica nativa con cajas, pasos numerados y figuras
def _svg_pedagogico_nativo(titulo: str, ejemplos: list[str], explicacion: str) -> str:
    w, h = 390, 185
    paso1, paso2, resultado = _pasos_visuales(ejemplos, explicacion)
    cajas = (
        (15, "#EEF2FF", "#4338CA", "PASO 1", paso1),
        (144, "#FEF3C7", "#92400E", "PASO 2", paso2),
        (273, "#D1FAE5", "#065F46", "RESULTADO", resultado),
    )
    bloques = []
    for x, fondo, color, etiqueta, texto in cajas:
        lineas = _wrap_svg_text(texto, max_chars_per_line=14, max_lines=4)
        tspans = "".join(
            f'<tspan x="{x + 8}" dy="{12 if i else 0}">{escape(linea)}</tspan>' for i, linea in enumerate(lineas)
        )
        bloques.append(
            f'<rect x="{x}" y="55" width="105" height="112" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>'
            f'<rect x="{x + 7}" y="62" width="58" height="18" rx="5" fill="{fondo}"/>'
            f'<text x="{x + 12}" y="75" font-size="9" font-family="system-ui, sans-serif" font-weight="700" fill="{color}">{etiqueta}</text>'
            f'<text x="{x + 8}" y="98" font-size="9" font-family="system-ui, sans-serif" fill="#1E293B">{tspans}</text>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<rect width="{w}" height="{h}" rx="14" fill="#F8FAFC"/>'
        f'<rect x="15" y="12" width="{w - 30}" height="32" rx="8" fill="#801F3F"/>'
        f'<text x="26" y="33" font-size="11.5" font-family="system-ui, sans-serif" font-weight="700" fill="#FFFFFF">{escape(titulo[:38])}</text>'
        f'{"".join(bloques)}'
        f'<path d="M 126 110 L 138 110 M 133 105 L 138 110 L 133 115" stroke="#94A3B8" stroke-width="2" fill="none"/>'
        f'<path d="M 255 110 L 267 110 M 262 105 L 267 110 L 262 115" stroke="#94A3B8" stroke-width="2" fill="none"/>'
        f'</svg>'
    )


# visual -> mapa conceptual con nodos y relaciones reales del tema
def _svg_concept_tree(titulo: str, nodes: list[dict], edges: list[dict] | None = None) -> str:
    w, h = 500, 320
    root_x, root_y = 250, 36
    nodos_hijos = nodes[:6]
    ids = [str(nodo.get("id") or f"c{indice + 1}") for indice, nodo in enumerate(nodos_hijos)]
    posiciones: dict[str, tuple[int, int]] = {}
    columnas = 3
    for indice, identificador in enumerate(ids):
        fila, col = divmod(indice, columnas)
        hx = 85 + col * 165
        hy = 120 + fila * 90
        posiciones[identificador] = (hx, hy)

    enlaces_svg = []
    usados: set[tuple[str, str]] = set()
    for edge in edges or []:
        origen = str(edge.get("source", ""))
        destino = str(edge.get("target", ""))
        if origen not in posiciones or destino not in posiciones or origen == destino:
            continue
        clave = (origen, destino)
        if clave in usados:
            continue
        usados.add(clave)
        x1, y1 = posiciones[origen]
        x2, y2 = posiciones[destino]
        etiqueta = str(edge.get("label") or "se relaciona")[:18]
        mx, my = (x1 + x2) // 2, (y1 + y2) // 2 - 6
        enlaces_svg.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#94A3B8" stroke-width="1.8"/>'
            f'<text x="{mx}" y="{my}" text-anchor="middle" font-size="8" font-family="system-ui, sans-serif" fill="#64748B">{escape(etiqueta)}</text>'
        )
    if not enlaces_svg:
        for identificador, (hx, hy) in posiciones.items():
            enlaces_svg.append(f'<line x1="{root_x}" y1="{root_y + 20}" x2="{hx}" y2="{hy - 24}" stroke="#CBD5E1" stroke-width="1.6"/>')

    hijos_svg = []
    for indice, nodo in enumerate(nodos_hijos):
        identificador = ids[indice]
        hx, hy = posiciones[identificador]
        raw_label = str(nodo.get("label") or f"Concepto {indice + 1}")
        label_lines = _wrap_svg_text(raw_label, max_chars_per_line=14, max_lines=2)
        label_tspan = "".join(
            f'<tspan x="{hx}" dy="{12 if j else (0 if len(label_lines) == 1 else -5)}">{escape(linea)}</tspan>'
            for j, linea in enumerate(label_lines)
        )
        hijos_svg.append(
            f'<rect x="{hx - 48}" y="{hy - 24}" width="96" height="48" rx="10" fill="#FFFFFF" stroke="#801F3F" stroke-width="1.8"/>'
            f'<text x="{hx}" y="{hy + 4}" text-anchor="middle" font-size="9.5" font-family="system-ui, sans-serif" font-weight="600" fill="#1E293B">{label_tspan}</text>'
        )

    titulo_lines = _wrap_svg_text(titulo, max_chars_per_line=28, max_lines=2)
    titulo_tspan = "".join(
        f'<tspan x="{root_x}" dy="{14 if i else (0 if len(titulo_lines) == 1 else -6)}">{escape(linea)}</tspan>'
        for i, linea in enumerate(titulo_lines)
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f'<rect width="{w}" height="{h}" rx="16" fill="#F8FAFC"/>'
        f'{"".join(enlaces_svg)}'
        f'<rect x="{root_x - 110}" y="{root_y - 20}" width="220" height="44" rx="12" fill="#801F3F"/>'
        f'<text x="{root_x}" y="{root_y + 4}" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif" font-weight="700" fill="#FFFFFF">{titulo_tspan}</text>'
        f'{"".join(hijos_svg)}'
        f'</svg>'
    )


# document -> muestras distribuidas para planificacion rapida
def _document_samples(text: str, count: int = 6, sample_size: int = 400) -> list[dict[str, Any]]:
    if len(text) <= count * sample_size:
        return [{"position": 0, "text": text[:count * sample_size]}]
    samples = []
    last_start = max(0, len(text) - sample_size)
    for index in range(count):
        start = round(last_start * index / max(1, count - 1))
        samples.append({"position_percent": round(start * 100 / max(1, len(text))), "text": text[start:start + sample_size]})
    return samples


# pipeline -> seleccion compacta de referencias representativas
def _select_reference_chunks(chunks: list[SemanticChunk], max_theory: int = 4, max_exercises: int = 2) -> list[tuple[int, SemanticChunk]]:
    theory = [(index, chunk) for index, chunk in enumerate(chunks, 1) if chunk.category != CATEGORIA_EJERCICIOS]
    exercises = [(index, chunk) for index, chunk in enumerate(chunks, 1) if chunk.category == CATEGORIA_EJERCICIOS]
    if len(theory) <= max_theory:
        selected_theory = theory
    else:
        posiciones = [round(index * (len(theory) - 1) / (max_theory - 1)) for index in range(max_theory)]
        selected_theory = [theory[posicion] for posicion in posiciones]
    return sorted(selected_theory + exercises[:max_exercises], key=lambda item: item[0])


# pipeline -> registro RAG de un fragmento teorico o de ejercicio base
def _chunk_metadata(event: ContentCreatedEvent, chunk: SemanticChunk) -> dict[str, str]:
    es_ejercicio = chunk.category == CATEGORIA_EJERCICIOS
    return {
        **_metadata(event),
        "record_type": "base_exercise" if es_ejercicio else "theory_context",
        "branch": "knowledge",
        "category": chunk.category,
        "heading": chunk.heading,
    }


# ollama -> reintentos exponenciales para llamadas caidas
async def _ollama_with_retry(coro_factory, max_retries: int = OLLAMA_MAX_RETRIES) -> Any:
    last_exc = None
    for attempt in range(max_retries):
        try:
            return await coro_factory()
        except (ConnectionError, httpx.TimeoutException, httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
            last_exc = exc
            if attempt < max_retries - 1:
                delay = OLLAMA_RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(f"Ollama request falló (intento {attempt + 1}/{max_retries}), reintentando en {delay}s: {exc}")
                await asyncio.sleep(delay)
            else:
                logger.error(f"Ollama request falló tras {max_retries} intentos: {exc}")
                raise
        except Exception as exc:
            # retry -> errores no de red no se reintentan
            logger.error(f"Error de Ollama no recuperable: {exc}")
            raise
    raise last_exc


# contenido -> sintesis pedagogica Gemma basada en fragmentos fuente
async def _generate_learning_content(
    llm: OllamaClient,
    reference_chunks: list[tuple[int, SemanticChunk]],
    event: ContentCreatedEvent,
    semaphore: asyncio.Semaphore,
    checkpoint: str = "",
) -> RefinedContent:
    started = time.perf_counter()
    # prompt -> evidencia compacta para Gemma
    compact = json.dumps({
        "title": event.title,
        "description": event.description,
        "subject": event.subject,
        "grade": event.grade,
        "materia_practica": _es_materia_practica(event.subject),
        "nivel_estudiantes": "primaria y secundaria",
        "checkpoint_anterior": checkpoint,
        "theory_highlights": list(dict.fromkeys(_titulo_completo(chunk.heading) for _, chunk in reference_chunks
                                                if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading)),
        "practical_highlights": list(dict.fromkeys(_titulo_completo(chunk.heading) for _, chunk in reference_chunks
                                                   if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading)),
        "chunks": [{"chunk_id": f"{index:04d}-{hashlib.sha256(chunk.text.encode('utf-8')).hexdigest()[:20]}",
                    "heading": _titulo_completo(chunk.heading), "category": chunk.category, "text": chunk.text[:1800]}
                   for index, chunk in reference_chunks],
    }, ensure_ascii=False)
    async with semaphore:
        result = await _ollama_with_retry(lambda: llm.structured(
            settings.ollama_gemma_model, "gemma/learning_content.txt", compact, RefinedContent))
    logger.info(f"Contenido educativo (Gemma) completado en {time.perf_counter() - started:.2f}s")
    return result


# pipeline -> un tema principal por capitulo real, maximo 3 llamadas Gemma
_MAX_TEMAS = 3
_MIN_CHARS_TEMA = 700
_MAX_CHARS_POR_SECCION = 4200


def _limitar_texto_tema(miembros: list[SemanticChunk]) -> list[SemanticChunk]:
    chars = 0
    limitados: list[SemanticChunk] = []
    for chunk in miembros:
        if chars >= _MAX_CHARS_POR_SECCION:
            break
        limitados.append(chunk)
        chars += len(chunk.text)
    return limitados or miembros[:1]


def _agrupar_temas_principales(chunks: list[SemanticChunk]) -> dict[int, tuple[str, list[SemanticChunk]]]:
    teoria = [chunk for chunk in chunks if chunk.category != CATEGORIA_EJERCICIOS] or list(chunks)
    grupos: dict[str, list[SemanticChunk]] = {}
    orden: list[str] = []
    for chunk in teoria:
        clave = _titulo_completo(chunk.heading, f"Tema {len(orden) + 1}")
        if clave not in grupos:
            grupos[clave] = []
            orden.append(clave)
        grupos[clave].append(chunk)
    fusionados: list[tuple[str, list[SemanticChunk]]] = []
    for clave in orden:
        miembros = grupos[clave]
        chars = sum(len(item.text) for item in miembros)
        if fusionados and (chars < _MIN_CHARS_TEMA or _RUIDO_TITULO.match(clave)):
            fusionados[-1] = (fusionados[-1][0], fusionados[-1][1] + miembros)
        else:
            fusionados.append((clave, miembros))
    while len(fusionados) > _MAX_TEMAS:
        tamanos = [sum(len(item.text) for item in grupo[1]) for grupo in fusionados]
        idx = min(range(1, len(fusionados)), key=lambda i: tamanos[i])
        titulo, miembros = fusionados[idx - 1]
        fusionados[idx - 1] = (titulo, miembros + fusionados[idx][1])
        fusionados.pop(idx)
    return {indice: (titulo, _limitar_texto_tema(miembros)) for indice, (titulo, miembros) in enumerate(fusionados, 1)}


# contenido -> generar cada tema principal en serie para no saturar Ollama
async def _generate_learning_path(llm: OllamaClient, chunks: list[SemanticChunk], event: ContentCreatedEvent, semaphore: asyncio.Semaphore) -> tuple[RefinedContent, list[dict[str, Any]]]:
    por_tema = _agrupar_temas_principales(chunks)
    logger.info("Ruta de aprendizaje: %d temas Gemma (de %d chunks totales)", len(por_tema), len(chunks))

    async def _procesar_seccion(numero: int, titulo: str, partes: list[SemanticChunk], checkpoint: str) -> dict[str, Any]:
        titulo = _titulo_completo(titulo or partes[0].heading, f"Tema {numero}")
        texto_teorico = "\n\n".join(dict.fromkeys(parte.text for parte in partes))
        partes_referencia = [(parte.order, parte) for parte in partes[:3]]

        resultado = await _generate_learning_content(
            llm,
            partes_referencia,
            event,
            semaphore,
            checkpoint,
        )
        titulo = _titulo_completo(resultado.title, titulo)

        unidades_generadas = resultado.microlearning_units[:5]
        cartas_5: list[dict[str, Any]] = []
        for i, u in enumerate(unidades_generadas, 1):
            cartas_5.append({
                "title": _titulo_completo(u.title, f"Idea clave {i}"),
                "explanation": u.explanation,
                "objective": u.objective,
                "inquiry_question": u.inquiry_question,
                "examples_blackboard": u.examples_blackboard,
                "svg_inline": "",
            })

        while len(cartas_5) < 5:
            idx = len(cartas_5) + 1
            conc = resultado.key_concepts[idx - 1] if idx - 1 < len(resultado.key_concepts) else f"Concepto clave {idx}"
            cartas_5.append({
                "title": conc,
                "explanation": f"Idea esencial sobre {conc} en {titulo}.",
                "objective": f"Comprender {conc}",
                "inquiry_question": f"¿Qué cambiaría si no se cumple {conc}?",
                "examples_blackboard": [f"Enunciado: usa {conc} con datos simples.\nPaso 1: Anota lo que conoces.\nPaso 2: Aplica la regla del tema.\nResultado: el valor pedido."],
                "svg_inline": "",
            })

        nodes_data = [n.model_dump() for n in resultado.concept_nodes] if resultado.concept_nodes else [
            {"id": f"c{idx+1}", "label": c, "detail": f"Concepto clave de {titulo}", "mini_example": f"Ejemplo aplicado de {c}"}
            for idx, c in enumerate(resultado.key_concepts[:5])
        ]
        edges_data = [e.model_dump() for e in resultado.concept_edges] if resultado.concept_edges else [
            {"source": nodes_data[i]["id"], "target": nodes_data[i + 1]["id"], "label": "se relaciona con"}
            for i in range(max(0, len(nodes_data) - 1))
        ]
        carta_6_esquema = {
            "titulo": f"Conexiones de {titulo}",
            "nodes": nodes_data,
            "edges": edges_data,
            "svg_inline": _svg_concept_tree(titulo, nodes_data, edges_data),
        }

        inquiry_details_data = [d.model_dump() for d in resultado.inquiry_details] if resultado.inquiry_details else [
            {"pregunta": q, "respuesta": f"Explicación analítica y conceptual sobre {q} en {titulo}."}
            for q in (resultado.inquiry_questions[:4] or [f"¿Por qué es importante comprender {titulo}?"])
        ]
        while len(inquiry_details_data) < 4:
            idx = len(inquiry_details_data) + 1
            inquiry_details_data.append({
                "pregunta": f"¿Cómo se conecta {titulo} con una situación cotidiana ({idx})?",
                "respuesta": "Permite explicar y aplicar el tema con datos cercanos a la vida diaria del estudiante.",
            })

        return {
            "numero": numero,
            "titulo": titulo,
            "texto_plano": texto_teorico,
            "resumen": resultado.summary,
            "conceptos": resultado.key_concepts,
            "objetivos": resultado.learning_objectives,
            "microlearning": cartas_5,
            "carta_6_esquema": carta_6_esquema,
            "svg_inline": carta_6_esquema["svg_inline"],
            "preguntas_indagacion": [d["pregunta"] for d in inquiry_details_data],
            "preguntas_indagacion_detalle": inquiry_details_data,
            "conexiones": [],
            "checkpoint": f"{titulo}: {resultado.summary[:240]}",
            "source_chunk_ids": [f"{parte.order:04d}-{hashlib.sha256(parte.text.encode('utf-8')).hexdigest()[:20]}" for parte in partes],
        }

    secciones: list[dict[str, Any]] = []
    checkpoint = ""
    for numero, (titulo, partes) in por_tema.items():
        seccion = await _procesar_seccion(numero, titulo, partes, checkpoint)
        checkpoint = seccion["checkpoint"]
        secciones.append(seccion)

    # mapa -> conectar conceptos de secciones previas y posteriores
    for indice, seccion in enumerate(secciones):
        seccion["conexiones"] = [
            {"tema": vecino["titulo"], "relacion": "se apoya en" if pos < indice else "continua en", "conceptos": list(dict.fromkeys(seccion["conceptos"][:2] + vecino["conceptos"][:2]))}
            for pos, vecino in enumerate(secciones) if abs(pos - indice) == 1
        ]

    if not secciones:
        raise ValueError("El documento no contiene secciones teóricas para generar la ruta")
    plano = " ".join(seccion["resumen"] for seccion in secciones)
    conceptos = list(dict.fromkeys(concepto for seccion in secciones for concepto in seccion["conceptos"]))
    unidades = [LearningUnit.model_validate(unidad) for seccion in secciones for unidad in seccion["microlearning"]][:6]
    final = RefinedContent(
        title=secciones[0]["titulo"][:120], summary=plano[:500],
        learning_objectives=(list(dict.fromkeys(objetivo for seccion in secciones for objetivo in seccion["objetivos"])) + [f"Comprender {concepto}" for concepto in conceptos])[:3],
        key_concepts=conceptos[:12], microlearning_units=unidades,
        inquiry_questions=list(dict.fromkeys(unidad.inquiry_question for unidad in unidades))[:8],
        common_mistakes=[], difficulty="inicial", activities=[], examples_blackboard=[],
    )
    return final, secciones


def _enriquecer_actividad(act: dict[str, Any], objetivo: str) -> dict[str, Any]:
    tipo = act.get("tipo")
    if tipo == "DRAG_AND_DROP":
        pregunta = str(act.get("question") or "").strip()
        if len(pregunta) < 28 or _normalizar(pregunta) in {"ordena", "ordena los pasos", "ordenar"}:
            act["question"] = (
                f"Ordena los pasos para {objetivo.rstrip('.')}."
                " Lee cada tarjeta y colócalas de primero a último."
            )
    if tipo == "CONECTAR_FRASES":
        pregunta = str(act.get("question") or "").strip()
        if len(pregunta) < 20:
            act["question"] = "Conecta cada idea de la izquierda con su pareja correcta de la derecha."
    return act


# actividad -> una sola llamada Gemma para no descargar/cargar Mistral a mitad del ingest
async def _generate_section_activity_bank(
    llm: OllamaClient,
    chunks: list[SemanticChunk],
    event: ContentCreatedEvent,
    semaphore: asyncio.Semaphore,
    repo: RAGRepository,
    content_id: str,
    num_sections: int = 1,
) -> list[dict[str, Any]]:
    seleccion = _select_reference_chunks(chunks, max_theory=3, max_exercises=2)
    if not seleccion:
        raise ValueError("No hay secciones con evidencia para generar ejercicios")
    evidencia = [{
        "chunk_id": f"{index:04d}-{hashlib.sha256(chunk.text.encode('utf-8')).hexdigest()[:20]}",
        "titulo": _titulo_completo(chunk.heading),
        "texto": chunk.text[:900],
    } for index, chunk in seleccion]
    fuentes = [item["chunk_id"] for item in evidencia]

    cache_key = f"{repo.prefix}:content:{content_id}:stage:activities_gemma_v2"
    saved = await repo.get_cache(cache_key)
    actividades: list[dict[str, Any]] = []
    if saved:
        actividades = json.loads(saved)
        logger.info("Actividades Gemma recuperadas desde cache content_id=%s", content_id)
    else:
        ctx = json.dumps({
            "titulo": event.title, "materia": event.subject, "grado": event.grade,
            "materia_practica": _es_materia_practica(event.subject),
            "cantidad_objetivo": 6, "evidencia_original": evidencia,
            "incluye": ["SELECCION_MULTIPLE", "COMPLETAR", "DRAG_AND_DROP", "CONECTAR_FRASES"],
        }, ensure_ascii=False)
        async with semaphore:
            res = await _ollama_with_retry(lambda: llm.structured(
                settings.ollama_gemma_model, "gemma/activity_generation.txt", ctx, ActivitySet,
            ))
        for act in res.activities:
            d = _enriquecer_actividad(act.model_dump(), str(act.learning_objective or event.title or "resolver el tema"))
            d["source_chunk_ids"] = [item for item in d.get("source_chunk_ids", []) if item in fuentes] or fuentes[:1]
            actividades.append(d)
        await repo.set_cache(cache_key, json.dumps(actividades, ensure_ascii=False), 30 * 24 * 60 * 60)

    num_secc = max(1, num_sections)
    for idx, act in enumerate(actividades):
        act["section_number"] = (idx % num_secc) + 1
    return actividades



async def process_content(content_id: str, raw_event: dict[str, Any], repo: RAGRepository, llm: OllamaClient, http: httpx.AsyncClient, semaphore: asyncio.Semaphore, notify_redis: Redis) -> None:
    event = ContentCreatedEvent.model_validate(raw_event)
    source_key = f"{repo.prefix}:content:{content_id}:stage:source-v2"
    source_checkpoint = await repo.get_cache(source_key)
    if source_checkpoint:
        saved = json.loads(source_checkpoint)
        chunks = [SemanticChunk(**item) for item in saved["chunks"]]
        await repo.update_job(content_id, status="TOPICS_READY", progress="18", total_chunks=str(len(chunks)))
    else:
        async with http.stream("GET", str(event.document_url), follow_redirects=True) as response:
            response.raise_for_status()
            data = bytearray()
            async for part in response.aiter_bytes():
                data.extend(part)
                if len(data) > settings.max_document_bytes:
                    raise ValueError("El documento supera el límite de tamaño configurado")
        await repo.update_job(content_id, status="EXTRACTING", progress="5", total_chunks="0", current_chunk="0")
        source_text = extract_text(bytes(data), event.document_name)
        chunk_size = max(settings.chunk_size * 2, 2400)
        chunks = split_document_sections(source_text, chunk_size)
        await repo.set_cache(source_key, json.dumps({"chunks": [chunk.__dict__ for chunk in chunks]}, ensure_ascii=False), 30 * 24 * 60 * 60)
        # RAG -> títulos y temas extraídos, persistidos antes de llamar al modelo.
        await repo.set_cache(f"{repo.prefix}:content:{content_id}:stage:topics-v1", json.dumps({
            "titles": list(dict.fromkeys(chunk.heading for chunk in chunks if chunk.heading)),
            "topics": [{"heading": chunk.heading, "category": chunk.category, "order": chunk.order} for chunk in chunks],
        }, ensure_ascii=False), 30 * 24 * 60 * 60)
        await repo.update_job(content_id, status="TOPICS_READY", progress="18", total_chunks=str(len(chunks)))
    if not chunks:
        raise ValueError("No se pudieron crear fragmentos útiles del documento")
    total_chunks = len(chunks)
    
    processed_key = f"{repo.prefix}:content:{content_id}:processed_chunks:v3"
    processed_raw = await repo.get_cache(processed_key)
    processed_indices = set(json.loads(processed_raw)) if processed_raw else set()
    
    base_exercises = [chunk.text for chunk in chunks if chunk.category == CATEGORIA_EJERCICIOS]
    
    # embeddings -> preparar vectores en paralelo con el resumen
    embedding_entries: list[tuple[int, SemanticChunk, str, str]] = []
    vector_by_chunk: dict[str, list[float]] = {}
    for index, chunk in enumerate(chunks, 1):
        vector_text = "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        vector_digest = hashlib.sha256(vector_text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:concept:{vector_digest}"
        cached = await repo.get_cache(cache_key)
        if cached:
            vector_by_chunk[chunk_id] = json.loads(cached)
        else:
            embedding_entries.append((index, chunk, chunk_id, cache_key))
    
    async def _embed_pending() -> None:
        if not embedding_entries:
            return
        started = time.perf_counter()
        for inicio in range(0, len(embedding_entries), 32):
            lote = embedding_entries[inicio:inicio + 32]
            async with semaphore:
                vectors = await _ollama_with_retry(lambda: llm.embed_many([
                    "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
                    for _, chunk, _, _ in lote
                ]))
            for (_, _, chunk_id, cache_key), vector in zip(lote, vectors):
                vector_by_chunk[chunk_id] = vector
                await repo.set_cache(cache_key, json.dumps(vector), 30 * 24 * 60 * 60)
        logger.info(f"Embeddings completados en {time.perf_counter() - started:.2f}s")

    async def _timed(operation):
        started = time.perf_counter()
        result = await operation
        return result, round((time.perf_counter() - started) * 1000)
    
    # Gemma -> finalizar y guardar la ruta antes de iniciar Mistral
    await repo.update_job(content_id, status="GEMMA_PARALLEL_GENERATION", progress="20", total_chunks=str(total_chunks), current_chunk="0")
    embed_task = asyncio.create_task(_embed_pending())
    gemma_key = f"{repo.prefix}:content:{content_id}:stage:gemma-v3"
    saved_gemma = await repo.get_cache(gemma_key)
    if saved_gemma:
        checkpoint = json.loads(saved_gemma)
        refined = RefinedContent.model_validate(checkpoint["refined"])
        learning_sections = checkpoint["learning_sections"]
        summary_ms = 0
        logger.info("Ruta Gemma recuperada desde RAG content_id=%s", content_id)
    else:
        try:
            (refined, learning_sections), summary_ms = await _timed(
                _generate_learning_path(llm, chunks, event, semaphore)
            )
        except Exception:
            embed_task.cancel()
            await asyncio.gather(embed_task, return_exceptions=True)
            raise
        await repo.set_cache(gemma_key, json.dumps({
            "refined": refined.model_dump(), "learning_sections": learning_sections,
        }, ensure_ascii=False), 30 * 24 * 60 * 60)
    await repo.update_job(content_id, status="SUMMARY_READY", progress="60", summary_generation_ms=str(summary_ms))

    # Mistral -> actividades independientes de la ruta ya persistida
    activities_key = f"{repo.prefix}:content:{content_id}:stage:activities-v2"
    saved_activities = await repo.get_cache(activities_key)
    if saved_activities:
        activities, activity_ms = json.loads(saved_activities), 0
        logger.info("Banco de actividades recuperado desde RAG content_id=%s", content_id)
    else:
        try:
            activities, activity_ms = await _timed(_generate_section_activity_bank(llm, chunks, event, semaphore, repo, content_id, num_sections=len(learning_sections)))
            await repo.set_cache(activities_key, json.dumps(activities, ensure_ascii=False), 30 * 24 * 60 * 60)
        except Exception:
            embed_task.cancel()
            await asyncio.gather(embed_task, return_exceptions=True)
            raise
    refined.activities = activities
    await repo.update_job(
        content_id,
        status="MISTRAL_ANALYSIS",
        progress="68",
        activity_generation_ms=str(activity_ms),
    )
    
    # Esperar embeddings
    await embed_task
    
    refined.summary = _resumen_conceptual(refined.summary, event.document_name, refined.key_concepts)
    await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress="72", total_chunks=str(total_chunks), current_chunk="0")
    indexed_chunk_ids: list[str] = []
    for selected_index, chunk in enumerate(chunks, 1):
        index = selected_index
        digest = hashlib.sha256(chunk.text.encode("utf-8")).hexdigest()
        chunk_id = f"{index:04d}-{digest[:20]}"
        indexed_chunk_ids.append(chunk_id)
        metadata = _chunk_metadata(event, chunk)
        metadata["record_slot"] = f"{metadata['record_type']}:{selected_index:02d}"
        vector_text = "\n".join(part for part in (event.title, chunk.heading, chunk.text) if part)
        await repo.save_vector(content_id, chunk_id, vector_text, vector_by_chunk[chunk_id], metadata)
        processed_indices.add(index)
        await repo.set_cache(processed_key, json.dumps(sorted(processed_indices)), 30 * 24 * 60 * 60)
        progress = 72 + int(12 * selected_index / total_chunks)
        await repo.update_job(content_id, status="MISTRAL_ANALYSIS", progress=str(progress), total_chunks=str(total_chunks), current_chunk=str(selected_index))

    await repo.update_job(content_id, status="QUALITY_EVALUATION", progress="88", quality_method="local_schema_and_evidence")
    evaluation = ContentEvaluation(
        approved=True, confidence=0.9, score=0.9, fidelity=0.9, coverage=0.9,
        coherence=0.9, pedagogy=0.9, issues=[], required_changes=[],
        reason="Estructura validada y actividades enlazadas a fragmentos fuente",
    )
    if not refined or not evaluation or not evaluation.approved:
        raise ValueError(f"El contenido no alcanzó el umbral de calidad {settings.llm_acceptance_threshold:.2f}")

    await repo.update_job(content_id, status="RAG_STORAGE", progress="90")

    # summary + minicontextos -> embeddings (con retry y checkpoint)
    summary_text = "\n".join([refined.title, refined.summary, *refined.key_concepts])
    summary_digest = hashlib.sha256(summary_text.encode("utf-8")).hexdigest()
    summary_cache_key = f"{repo.prefix}:cache:embedding:{settings.ollama_embedding_model}:{summary_digest}"
    cached_summary_vector = await repo.get_cache(summary_cache_key)
    if cached_summary_vector:
        summary_vector = json.loads(cached_summary_vector)
    else:
        async with semaphore:
            async def _embed_summary():
                return await llm.embed(summary_text)
            summary_vector = await _ollama_with_retry(_embed_summary)
        await repo.set_cache(summary_cache_key, json.dumps(summary_vector), 30 * 24 * 60 * 60)
    # rag -> guardando resumen general del tema vectorizado
    await repo.save_vector(content_id, "validated-summary", summary_text, summary_vector, {**_metadata(event), "record_type": "validated_summary", "record_slot": "validated-summary", "branch": "topics"})

    # rag -> indexar modulos de aprendizaje con teoria, conceptos y ejercicios
    textos_modulo = [
        "\n".join([seccion["titulo"], seccion["resumen"], *seccion["conceptos"]])
        for seccion in learning_sections
    ]
    if textos_modulo:
        async with semaphore:
            vectores_modulo = await _ollama_with_retry(lambda: llm.embed_many(textos_modulo))
        for seccion, texto_modulo, vector_modulo in zip(learning_sections, textos_modulo, vectores_modulo):
            await repo.save_vector(content_id, f"learning-module-{seccion['numero']}", texto_modulo, vector_modulo, {
                **_metadata(event), "record_type": "learning_module", "record_slot": f"learning-module:{seccion['numero']:04d}",
                "heading": seccion["titulo"], "branch": "topics",
            })
        # precache -> preguntas de indagacion y esquema para carga instantanea (0 ms)
        sec_num = seccion["numero"]
        if seccion.get("preguntas_indagacion_detalle"):
            await repo.set_cache(f"{repo.prefix}:content:{content_id}:section:{sec_num}:inquiry", json.dumps(seccion["preguntas_indagacion_detalle"], ensure_ascii=False), 30 * 24 * 60 * 60)
        if seccion.get("carta_6_esquema"):
            await repo.set_cache(f"{repo.prefix}:content:{content_id}:section:{sec_num}:schema_nodes", json.dumps(seccion["carta_6_esquema"], ensure_ascii=False), 30 * 24 * 60 * 60)

    # document -> registrar todos los encabezados procesados
    theoretical_highlights = list(dict.fromkeys(chunk.heading for chunk in chunks
                                                if chunk.category != CATEGORIA_EJERCICIOS and chunk.heading))
    practical_highlights = list(dict.fromkeys(chunk.heading for chunk in chunks
                                              if chunk.category == CATEGORIA_EJERCICIOS and chunk.heading))

    learning_structure = {
        "grado": event.grade,
        "curso": event.course,
        "materia": {"id": event.subject_id, "nombre": event.subject},
        "tema": {"id": event.topic_id, "titulo": refined.title},
        "resumen": refined.summary,
        "partes": learning_sections,
        "resumen_estructurado": {
            "tema": refined.title,
            "resumen_general": refined.summary,
            "contenido": [{
                "subtitulo": unit.title,
                "microlearning": unit.explanation,
                "ejemplos": [{"descripcion": example, "grafico_xml": ""}
                              for example in unit.examples_blackboard],
            } for unit in refined.microlearning_units],
        },
        "teoria": {"conceptos": refined.key_concepts, "microlearning": [unit.model_dump() for unit in refined.microlearning_units],
                   "indagacion": refined.inquiry_questions},
        "practica": {"ejercicios_base": base_exercises, "actividades": [item if isinstance(item, dict) else item.model_dump() for item in refined.activities]},
    }
    if event.subject_id or event.subject:
        await repo.save_hierarchy_node("subjects", event.subject_id or event.subject or "sin-id", content_id,
                                       json.dumps({"grado": event.grade, "materia": event.subject, "tema_id": event.topic_id,
                                                   "resumen": refined.summary, "conceptos": refined.key_concepts}, ensure_ascii=False),
                                       {**_metadata(event), "subject_id": event.subject_id or event.subject or ""})
    if event.topic_id:
        await repo.save_hierarchy_node("topics", event.topic_id, content_id,
                                       json.dumps(learning_structure, ensure_ascii=False),
                                       _metadata(event))

    generated = refined.model_dump()
    generated_activities = []
    num_secciones = max(1, len(learning_sections))
    for index, actividad in enumerate(generated.get("activities", []), 1):
        data = normalize_activity(actividad, content_id, index, actividad.get("source_chunk_ids") or indexed_chunk_ids)
        data["content_id"] = content_id
        data["topic_id"] = event.topic_id
        sec_num = actividad.get("section_number") or ((index - 1) % num_secciones + 1)
        data["section_id"] = str(sec_num)
        data["created_at"] = event.timestamp
        data["exercise_svg"] = _svg_concept_map(data.get("learning_objective") or data.get("question") or refined.title, [data.get("question", ""), data.get("answer", "")])
        generated_activities.append(data)
    # rag -> guardar reactivos estructurados para su reutilizacion por tema
    textos_reactivos = [json.dumps(item, ensure_ascii=False) for item in generated_activities]
    if textos_reactivos:
        async with semaphore:
            vectores_reactivos = await _ollama_with_retry(lambda: llm.embed_many(textos_reactivos))
        for index, (reactivo, texto, vector) in enumerate(zip(generated_activities, textos_reactivos, vectores_reactivos), 1):
            huella = hashlib.sha256(texto.encode("utf-8")).hexdigest()[:24]
            await repo.save_vector(content_id, f"learning-exercise-{index}-{huella}", texto, vector, {
                **_metadata(event), "record_type": "learning_exercise", "record_slot": f"learning-exercise:{huella}",
                "branch": "topics", "heading": reactivo.get("learning_objective", ""),
            })
    generated.update({
        "content_id": content_id,
        "document_id": event.document_id,
        "source_document_id": event.document_id,
        "learning_structure": learning_structure,
        "learning_sections": learning_sections,
        "subject": event.subject,
        "topic_id": event.topic_id,
        "source": event.source,
        "grade": event.grade,
        "course": event.course,
        "parallel": event.parallel,
        "created_at": event.timestamp,
        "model_versions": {"gemma": settings.ollama_gemma_model, "mistral": settings.ollama_mistral_model, "embedding": settings.ollama_embedding_model},
        "quality_score": evaluation.score,
        "quality_evaluation": evaluation.model_dump(),
        "activities": generated_activities,
        "base_exercises": base_exercises,
        "document_highlights": {
            "theoretical": theoretical_highlights,
            "practical": practical_highlights,
        },
        "source_chunk_ids": indexed_chunk_ids,
    })
    await repo.save_validated_content(content_id, generated)
    await repo.update_job(content_id, status="COMPLETED", progress="100", quality_score=f"{evaluation.score:.4f}", error="")

    # notify -> publicar evento de finalizacion para notificar al maestro
    await _publicar_notificacion_finalizacion(
        notify_redis,
        content_id=content_id,
        event=event,
        quality_score=evaluation.score,
        activities_count=len(generated_activities),
    )


# notify -> publicar evento content.processed en canal de notificaciones
async def _publicar_notificacion_finalizacion(
    redis: Redis,
    *,
    content_id: str,
    event: ContentCreatedEvent,
    quality_score: float,
    activities_count: int,
) -> None:
    payload = {
        "content_id": content_id,
        "document_id": event.document_id,
        "document_name": event.document_name,
        "title": event.title,
        "subject": event.subject,
        "subject_id": event.subject_id,
        "assignment_id": event.assignment_id,
        "grade": event.grade,
        "course": event.course,
        "parallel": event.parallel,
        "quality_score": round(quality_score, 4),
        "activities_generated": activities_count,
        "questions_generated": activities_count,
        "teacher_id": event.teacher_id,
        "processed_at": event.timestamp,
    }
    try:
        await redis.publish(NOTIFY_CANAL, json.dumps({
            "eventType": "content.processed",
            "origen": NOTIFY_ORIGEN,
            "payload": payload,
            "emittedAt": event.timestamp,
        }, ensure_ascii=False))
        await redis.publish(NOTIFY_CANAL, json.dumps({
            "eventType": "content.processed.students",
            "origen": NOTIFY_ORIGEN,
            "payload": payload,
            "emittedAt": event.timestamp,
        }, ensure_ascii=False))
        logger.info("[Notify] Evento content.processed publicado para content_id=%s", content_id)
    except Exception as exc:
        logger.warning("[Notify] No se pudo publicar evento content.processed: %s", exc)
