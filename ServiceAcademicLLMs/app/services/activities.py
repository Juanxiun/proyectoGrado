import hashlib
import random
import re
import unicodedata

# activities -> campos que revelan la respuesta segun el tipo
CAMPOS_RESPUESTA = {
    "SELECCION_MULTIPLE": ("correct_answer", "explanation", "source_chunk_ids"),
    "CUESTIONARIO": ("keywords", "model_answer", "explanation", "source_chunk_ids"),
    "FLASHCARD": ("source_chunk_ids",),
    "VERDADERO_FALSO": ("answer", "justification", "source_chunk_ids"),
    "CONECTAR_FRASES": ("explanation", "source_chunk_ids"),
    "DRAG_AND_DROP": ("correct_order", "explanation", "source_chunk_ids"),
}

# activities -> campos visibles para el estudiante
CAMPOS_PUBLICOS = {
    "SELECCION_MULTIPLE": ("question", "options"),
    "CUESTIONARIO": ("question",),
    "FLASHCARD": ("front", "back"),
    "VERDADERO_FALSO": ("statement",),
    "CONECTAR_FRASES": (),
    "DRAG_AND_DROP": ("question", "items"),
}

# activities -> respuestas validas de autoevaluacion flashcard
RESPUESTAS_FLASHCARD = {"recordado", "recordada", "si", "verdadero", "lo recuerdo", "ya lo se"}


# activities -> normalizacion sin acentos ni mayusculas
def _norm(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", str(texto).casefold())
    limpio = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", limpio).strip()


# activities -> texto canonico usado como huella de la actividad
def activity_statement(activity: dict) -> str:
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


# activities -> copia sin respuestas ni metadatos internos
def public_activity(activity: dict, semilla: str = "") -> dict:
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
    for campo in ("difficulty", "learning_objective"):
        if campo in activity:
            publico[campo] = activity[campo]
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


# activities -> pares de conectar frases desde texto libre
def _parse_pares(response: str) -> dict[str, str]:
    pares: dict[str, str] = {}
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
    tipo = activity.get("tipo", "SELECCION_MULTIPLE")
    respuesta = _norm(response)
    if not respuesta:
        raise ValueError("La respuesta no puede estar vacía")
    if tipo == "SELECCION_MULTIPLE":
        opciones = {_norm(opcion) for opcion in activity.get("options", [])}
        if respuesta not in opciones:
            raise ValueError("Una respuesta no coincide con las opciones de su actividad")
        return respuesta == _norm(activity.get("correct_answer", ""))
    if tipo == "CUESTIONARIO":
        claves = [_norm(clave) for clave in activity.get("keywords", [])]
        if not claves:
            return respuesta == _norm(activity.get("model_answer", ""))
        aciertos = sum(1 for clave in claves if clave and clave in respuesta)
        return aciertos >= max(1, (len(claves) + 1) // 2)
    if tipo == "FLASHCARD":
        return respuesta in RESPUESTAS_FLASHCARD
    if tipo == "VERDADERO_FALSO":
        if respuesta not in {"verdadero", "falso", "v", "f", "true", "false"}:
            raise ValueError("La respuesta debe ser verdadero o falso")
        elegida = respuesta in {"verdadero", "v", "true"}
        return elegida == bool(activity.get("answer"))
    if tipo == "CONECTAR_FRASES":
        pares = _parse_pares(response)
        esperado = {_norm(par.get("left", "")): _norm(par.get("right", "")) for par in activity.get("pairs", [])}
        if set(pares) != set(esperado):
            raise ValueError("Debe relacionar exactamente los pares emitidos")
        return all(pares[lado] == derecha for lado, derecha in esperado.items())
    if tipo == "DRAG_AND_DROP":
        orden = [_norm(item) for item in re.split(r"[;|,]", response) if item.strip()]
        esperado = [_norm(item) for item in activity.get("correct_order", [])]
        return orden == esperado and bool(orden)
    raise ValueError(f"Tipo de actividad no admitido: {tipo}")


# feedback -> explicacion correctiva ligada al concepto evaluado
def remediation(activity: dict, correct: bool) -> dict[str, str]:
    tipo = activity.get("tipo", "")
    concept = str(activity.get("learning_objective", "Concepto evaluado"))
    if tipo == "SELECCION_MULTIPLE":
        answer = str(activity.get("correct_answer", ""))
        explanation = str(activity.get("explanation", ""))
    elif tipo == "CUESTIONARIO":
        answer = str(activity.get("model_answer", ""))
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
