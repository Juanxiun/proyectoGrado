import hashlib
import json
import random
import re
import unicodedata

# activities -> campos que revelan la respuesta segun el tipo (LEGACY: mantener para compatibilidad UI)
CAMPOS_RESPUESTA = {
    "SELECCION_MULTIPLE": ("correct_answer", "explanation", "source_chunk_ids"),
    "COMPLETAR": ("correct_answer", "explanation", "source_chunk_ids"),
    "FLASHCARD": ("source_chunk_ids",),
    "VERDADERO_FALSO": ("answer", "justification", "source_chunk_ids"),
    "CONECTAR_FRASES": ("explanation", "source_chunk_ids"),
    "DRAG_AND_DROP": ("correct_order", "explanation", "source_chunk_ids"),
}

# activities -> campos visibles para el estudiante (LEGACY: mantener para compatibilidad UI)
CAMPOS_PUBLICOS = {
    "SELECCION_MULTIPLE": ("question", "options"),
    "COMPLETAR": ("question", "options"),
    "FLASHCARD": ("front", "back"),
    "VERDADERO_FALSO": ("statement",),
    "CONECTAR_FRASES": ("question",),
    "DRAG_AND_DROP": ("question", "items"),
}

# activities -> respuestas validas de autoevaluacion flashcard (LEGACY)
RESPUESTAS_FLASHCARD = {"recordado", "recordada", "si", "verdadero", "lo recuerdo", "ya lo se"}

# activities -> nuevos tipos de reactivo Fase 2
ACTIVITY_SEED_TYPES = ("THEORETICAL", "PRACTICAL")


# activities -> normalizacion sin acentos ni mayusculas
def _norm(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", str(texto).casefold())
    limpio = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", limpio).strip()


# activities -> detectar si es formato nuevo (ActivitySeed) o legacy
def _is_seed_format(activity: dict) -> bool:
    return activity.get("type") in ACTIVITY_SEED_TYPES


# activities -> texto canonico usado como huella de la actividad
def activity_statement(activity: dict) -> str:
    if _is_seed_format(activity):
        return str(activity.get("question", ""))
    tipo = activity.get("tipo", "SELECCION_MULTIPLE")
    if tipo == "FLASHCARD":
        return str(activity.get("front", ""))
    if tipo == "VERDADERO_FALSO":
        return str(activity.get("statement", ""))
    if tipo == "CONECTAR_FRASES":
        return "; ".join(f"{par.get('left', '')} => {par.get('right', '')}" for par in activity.get("pairs", []))
    return str(activity.get("question", ""))


# activities -> huella estable para evitar repeticiones
def fingerprint(statement: str) -> str:
    return hashlib.sha256(_norm(statement).encode("utf-8")).hexdigest()


# activities -> identificador trazable de cada actividad
def activity_id(content_id: str, index: int, statement: str) -> str:
    return hashlib.sha256(f"{content_id}:{index}:{statement}".encode("utf-8")).hexdigest()


# activities -> copia sin respuestas ni metadatos internos (LEGACY: para UI con formatos de interaccion)
def public_activity(activity: dict, semilla: str = "", banco: list[dict] | None = None) -> dict:
    if _is_seed_format(activity):
        # migracion -> los bancos previos no deben romper retos ya guardados.
        return {
            "activity_id": activity.get("activity_id", ""),
            "tipo": "COMPLETAR",
            "question": f"Completa la respuesta: {activity.get('question', '')} _____",
            "difficulty": activity.get("difficulty", "inicial"),
            "learning_objective": activity.get("learning_objective", ""),
            "exercise_svg": activity.get("exercise_svg", ""),
        }
    tipo = activity.get("tipo", "SELECCION_MULTIPLE")
    publico = {"activity_id": activity.get("activity_id", ""), "tipo": tipo}
    for campo in CAMPOS_PUBLICOS.get(tipo, ("question",)):
        if campo in activity:
            publico[campo] = activity[campo]
    if tipo == "CONECTAR_FRASES":
        pares = activity.get("pairs", [])
        lados = [str(par.get("left", "")) for par in pares]
        derechos = [str(par.get("right", "")) for par in pares]
        random.Random(semilla or activity.get("activity_id", "")).shuffle(derechos)
        publico["left_items"] = lados
        publico["right_items"] = derechos
    if tipo == "COMPLETAR":
        opciones = [str(opt).strip() for opt in (activity.get("options") or []) if str(opt).strip()]
        correcta = str(activity.get("correct_answer") or "").strip()
        if not opciones and correcta:
            candidatos = []
            if banco:
                for b_act in banco:
                    c = str(b_act.get("correct_answer") or b_act.get("answer") or "").strip()
                    if c and c.lower() != correcta.lower() and len(c) <= 60 and c not in candidatos:
                        candidatos.append(c)
                    for opt in b_act.get("options") or []:
                        opt_str = str(opt).strip()
                        if opt_str and opt_str.lower() != correcta.lower() and len(opt_str) <= 60 and opt_str not in candidatos:
                            candidatos.append(opt_str)
            distractores = candidatos[:3]
            while len(distractores) < 3:
                distractores.append(f"Término {len(distractores) + 1}")
            opciones = [correcta, *distractores]
        if opciones:
            rng = random.Random(semilla or activity.get("activity_id", ""))
            rng.shuffle(opciones)
            publico["options"] = opciones
    for campo in ("difficulty", "learning_objective"):
        if campo in activity:
            publico[campo] = activity[campo]
    if activity.get("exercise_svg"):
        publico["exercise_svg"] = activity["exercise_svg"]
    if tipo == "DRAG_AND_DROP" and semilla:
        mezcla = list(publico.get("items", []))
        random.Random(semilla).shuffle(mezcla)
        publico["items"] = mezcla
    return publico


# generator -> estrutura de actividad lista para guardar en el banco
def normalize_activity(activity: dict, content_id: str, index: int, chunk_ids: list[str] | None = None) -> dict:
    data = dict(activity)
    statement = activity_statement(data)
    data["activity_id"] = activity_id(content_id, index, statement)
    data["fingerprint"] = fingerprint(statement)
    data.setdefault("difficulty", "inicial")
    if chunk_ids and not data.get("source_chunk_ids"):
        data["source_chunk_ids"] = chunk_ids
    return data


# activities -> pares de conectar frases desde texto libre (LEGACY)
def _parse_pares(response: str) -> dict[str, str]:
    pares: dict[str, str] = {}
    try:
        pares_json = json.loads(response)
        if isinstance(pares_json, dict):
            return {_norm(lado): _norm(derecha) for lado, derecha in pares_json.items() if str(lado).strip() and str(derecha).strip()}
    except (json.JSONDecodeError, TypeError):
        pass
    for trozo in [item.strip() for item in response.split(";") if item.strip()]:
        separado = re.split(r"(?:=>|->|→|=)", trozo, maxsplit=1)
        if len(separado) != 2 or not separado[0].strip() or not separado[1].strip():
            raise ValueError("Cada par debe escribirse como lado A => lado B separado por punto y coma")
        pares[_norm(separado[0])] = _norm(separado[1])
    if not pares:
        raise ValueError("Debe enviar al menos un par relacionado")
    return pares


# activities -> correccion de una respuesta segun el tipo de actividad
def score_activity(activity: dict, response: str) -> bool:
    respuesta = _norm(response)
    if not respuesta:
        raise ValueError("La respuesta no puede estar vacía")
    try:
        if _is_seed_format(activity):
            expected = _norm(activity.get("answer", activity.get("correct_answer", "")))
            return respuesta == expected

        tipo = activity.get("tipo", "SELECCION_MULTIPLE")
        if tipo == "SELECCION_MULTIPLE":
            return respuesta == _norm(activity.get("correct_answer", ""))
        if tipo == "COMPLETAR":
            return respuesta == _norm(activity.get("correct_answer", activity.get("answer", "")))
        if tipo == "FLASHCARD":
            return respuesta in RESPUESTAS_FLASHCARD
        if tipo == "VERDADERO_FALSO":
            if respuesta not in {"verdadero", "falso", "v", "f", "true", "false"}:
                return False
            elegida = respuesta in {"verdadero", "v", "true"}
            return elegida == bool(activity.get("answer"))
        if tipo == "CONECTAR_FRASES":
            pares = _parse_pares(response)
            esperado = {_norm(par.get("left", "")): _norm(par.get("right", "")) for par in activity.get("pairs", [])}
            if set(pares) != set(esperado):
                return False
            return all(pares[lado] == derecha for lado, derecha in esperado.items())
        if tipo == "DRAG_AND_DROP":
            orden = [_norm(item) for item in re.split(r"[;|,]", response) if item.strip()]
            esperado = [_norm(item) for item in activity.get("correct_order", [])]
            return orden == esperado and bool(orden)
        return False
    except ValueError:
        return False


# feedback -> explicacion correctiva ligada al concepto evaluado
def remediation(activity: dict, correct: bool) -> dict[str, str]:
    if _is_seed_format(activity):
        concept = str(activity.get("learning_objective", "Concepto evaluado"))
        answer = str(activity.get("answer", ""))
        explanation = str(activity.get("explanation", ""))
        return {
            "concept": concept,
            "where_failed": "" if correct else f"Revisa: {concept}.",
            "correct_answer": answer,
            "explanation": explanation,
        }

    # LEGACY: logica original para formatos de interaccion
    tipo = activity.get("tipo", "")
    concept = str(activity.get("learning_objective", "Concepto evaluado"))
    if tipo == "SELECCION_MULTIPLE":
        answer = str(activity.get("correct_answer", ""))
        explanation = str(activity.get("explanation", ""))
    elif tipo == "COMPLETAR":
        answer = str(activity.get("correct_answer", ""))
        explanation = str(activity.get("explanation", ""))
    elif tipo == "FLASHCARD":
        answer = str(activity.get("back", ""))
        explanation = answer
    elif tipo == "VERDADERO_FALSO":
        answer = "Verdadero" if activity.get("answer") else "Falso"
        explanation = str(activity.get("justification", ""))
    elif tipo == "CONECTAR_FRASES":
        answer = "; ".join(f"{pair.get('left', '')} => {pair.get('right', '')}" for pair in activity.get("pairs", []))
        explanation = str(activity.get("explanation", ""))
    elif tipo == "DRAG_AND_DROP":
        answer = "; ".join(str(item) for item in activity.get("correct_order", []))
        explanation = str(activity.get("explanation", ""))
    else:
        answer, explanation = "", ""
    return {
        "concept": concept,
        "where_failed": "" if correct else f"Revisa: {concept}.",
        "correct_answer": answer,
        "explanation": explanation,
    }
