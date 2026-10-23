import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field

# chunking -> categorias semanticas de fragmento
CATEGORIA_TEORIA = "teoria"
CATEGORIA_EJERCICIOS = "ejercicio"

# chunking -> palabras sin carga semantica
STOPWORDS = {
    "para", "como", "pero", "este", "esta", "estos", "estas", "muy", "mas", "muy",
    "los", "las", "del", "con", "por", "una", "uno", "que", "segun", "entre",
    "donde", "cuando", "porque", "puede", "pueden", "debe", "deben", "tambien",
    "sobre", "cada", "otro", "otra", "otros", "otras", "hacia", "desde", "hasta",
}

# chunking -> encabezados y pies de pagina repetidos
PATRON_RUIDO = re.compile(
    r"^("
    r"p[aá]g(ina)?\.?\s*\d+(\s*(de|del|/)\s*\d+)?"
    r"|\d{1,4}"
    r"|[=_\-~·•*|]{3,}"
    r")$",
    re.IGNORECASE,
)

# chunking -> metadatos no informativos del documento
PATRON_METADATO = re.compile(
    r"(https?://|www\.|copyright|todos los derechos reservados|impreso por|"
    r"fecha de impresi[oó]n|instituci[oó]n educativa|p[aá]gina web|@[\w.-]+)",
    re.IGNORECASE,
)
PATRON_CABECERA_PERSONAL = re.compile(
    r"^(?:nombre(?:s)?(?:\s+y\s+apellidos?)?|apellidos?|estudiante|alumno|docente|profesor(?:a)?|"
    r"curso|paralelo|grado|fecha|materia|asignatura|unidad educativa|colegio|institucion educativa|"
    r"gestion|firma|calificacion|puntaje)(?:\s+(?:del|de la) estudiante)?\s*(?::|[-_]{1,}|\.{2,}).*$",
    re.IGNORECASE,
)
PATRON_CABECERA_MULTICAMPO = re.compile(
    r"(?:^|[|¦])\s*(?:nombres?|apellidos?|estudiante|alumno|docente|profesor|curso|paralelo|grado|fecha|materia|asignatura|institucion)\s*(?:[|¦]|$)",
    re.IGNORECASE,
)
PATRON_OPERADOR_FINAL = re.compile(r"[=+\-×÷*/^√∫∑≤≥(]\s*$")
PATRON_OPERADOR_INICIO = re.compile(r"^[=+\-×÷*/^√∫∑≤≥)]")

# chunking -> titulos markdown numericos y en dos puntos
PATRON_MD = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
PATRON_NUMERICO = re.compile(r"^(\d+(?:\.\d+){0,3})[.)]?\s+(\S.*)$")
PATRON_ROMANO = re.compile(r"^([IVXLC]{1,6})[.)]\s+(\S.*)$")
PATRON_DOSPUNTOS = re.compile(r"^[A-ZÁÉÍÓÚÜÑ0-9][^\n]{0,88}:\s*$")
PATRON_TITULO = re.compile(r"^[A-ZÁÉÍÓÚÜÑ0-9][^\n.]{2,78}$")
PATRON_ACTIVIDAD = re.compile(r"^((?:actividad|ejercicio|pr[aá]ctica|tarea)\s*\d*)\.?(?:\s+(.*))?$", re.IGNORECASE)

# chunking -> inicio de un ejercicio numerado
PATRON_INICIO_EJERCICIO = re.compile(
    r"^(ejercicio\s*\d*|problema\s*\d*|pr[aá]ctica\s*\d*|actividad\s*\d*|\d{1,3}[.)]|[a-z][.)])\s*\S",
    re.IGNORECASE,
)

# chunking -> verbos que indican razonamiento complejo
VERBOS_DIFICILES = (
    "demuestra", "resuelve", "calcula", "deduce", "analiza", "compara", "evalua",
    "evalúe", "disena", "diseña", "justifica", "verifica", "interpreta", "propon",
    "comprueba", "deduzca", "rafona",
)

# chunking -> verbos que indican ejercicio sencillo
VERBOS_FACILES = (
    "define", "identifica", "señala", "senal", "enumera", "completa", "selecciona",
    "relaciona", "observa", "indica", "nombra", "escribe", "marca",
)

# chunking -> formulas o expresiones con operaciones
PATRON_FORMULA = re.compile(r"(?:[a-z0-9)]\s*(?:=|[+\-*/^√∫∑≤≥])\s*[a-z0-9(]|[√∫∑≤≥])", re.IGNORECASE)

# chunking -> secciones de practica y ejercicios
PATRON_SECCION_EJERCICIOS = re.compile(
    r"(ejercicios?|pr[aá]cticas?|actividad(?:es)?|tareas?|problemas?|ejercitaci[oó]n|cuestionario|quizz?)",
    re.IGNORECASE,
)


# chunking -> fragmento con titulo, categoria y dificultad
@dataclass
class SemanticChunk:
    text: str
    heading: str = ""
    category: str = CATEGORIA_TEORIA
    order: int = 0
    difficulty_hint: str = ""
    meta: dict = field(default_factory=dict)


# chunking -> normalizacion sin acentos ni mayusculas
def _normalizar(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", texto.casefold())
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


# chunking -> limpieza de ruido, metadatos y encabezados repetidos
def filter_noise(text: str) -> str:
    lineas = text.splitlines()
    conteo: Counter[str] = Counter()
    for linea in lineas:
        limpio = re.sub(r"\s+", " ", _normalizar(linea.strip()))
        if 3 <= len(limpio) <= 100 and not PATRON_RUIDO.match(limpio):
            conteo[limpio] += 1
    conservadas: list[str] = []
    for linea in lineas:
        limpio = linea.strip()
        if not limpio:
            conservadas.append("")
            continue
        normalizado = re.sub(r"\s+", " ", _normalizar(limpio))
        if PATRON_RUIDO.match(normalizado):
            continue
        if PATRON_CABECERA_PERSONAL.match(normalizado):
            continue
        if len(PATRON_CABECERA_MULTICAMPO.findall(normalizado)) >= 2:
            continue
        if conteo[normalizado] >= 3:
            continue
        if PATRON_METADATO.search(normalizado):
            continue
        conservadas.append(linea)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(conservadas)).strip()


# chunking -> deteccion de linea que abre una seccion
def _es_titulo(linea: str, siguiente: str) -> tuple[bool, int, str]:
    coincidencia = PATRON_MD.match(linea)
    if coincidencia:
        return True, len(coincidencia.group(1)), coincidencia.group(2).strip()
    limpio = linea.strip()
    if not limpio or len(limpio) > 90:
        return False, 0, ""
    actividad = PATRON_ACTIVIDAD.match(limpio)
    if actividad:
        return True, 2, actividad.group(1).strip()
    if PATRON_DOSPUNTOS.match(limpio):
        return True, 3, limpio.rstrip(":").strip()
    romano = PATRON_ROMANO.match(limpio)
    if romano:
        return True, 2, romano.group(2).strip()
    numerico = PATRON_NUMERICO.match(limpio)
    if numerico:
        cuerpo = numerico.group(2).strip()
        jerarquia = numerico.group(1).count(".") + 1
        con_punto = cuerpo.endswith(".")
        if "." in numerico.group(1) and not con_punto:
            return True, min(jerarquia + 1, 6), cuerpo
    if PATRON_TITULO.match(limpio) and not limpio.endswith((".", ",", ";")) and siguiente.strip():
        return True, 4, limpio
    return False, 0, ""


# chunking -> separacion por titulos y subtitulos del documento
def _split_sections(text: str) -> list[tuple[str, int, str]]:
    lineas = text.splitlines()
    siguiente_no_vacio = ""
    por_linea: list[str] = ["" for _ in lineas]
    for indice in range(len(lineas) - 1, -1, -1):
        if lineas[indice].strip():
            siguiente_no_vacio = lineas[indice].strip()
        por_linea[indice] = siguiente_no_vacio
    secciones: list[tuple[str, int, str]] = []
    titulo, nivel, cuerpo = "", 0, []
    for indice, linea in enumerate(lineas):
        es_titulo, nivel_titulo, texto_titulo = _es_titulo(linea, por_linea[indice])
        if es_titulo and texto_titulo:
            if cuerpo:
                secciones.append((titulo, nivel, "\n".join(cuerpo).strip()))
            actividad = PATRON_ACTIVIDAD.match(linea.strip())
            resto = actividad.group(2).strip() if actividad and actividad.group(2) else ""
            titulo, nivel, cuerpo = texto_titulo, nivel_titulo, [resto] if resto else []
        else:
            cuerpo.append(linea)
    if cuerpo:
        secciones.append((titulo, nivel, "\n".join(cuerpo).strip()))
    return [seccion for seccion in secciones if seccion[2]]


# chunking -> oraciones como unidad minima de coherencia
def _oraciones(cuerpo: str) -> list[str]:
    lineas = [linea.strip() for linea in cuerpo.splitlines() if linea.strip()]
    continuadas: list[str] = []
    for linea in lineas:
        if continuadas and (PATRON_OPERADOR_FINAL.search(continuadas[-1]) or PATRON_OPERADOR_INICIO.match(linea)):
            continuadas[-1] = f"{continuadas[-1]} {linea}"
        else:
            continuadas.append(linea)
    texto = "\n".join(continuadas)
    trozos = re.split(r"(?<=[.!?])\s+|\n+", texto)
    return [trozo.strip() for trozo in trozos if len(trozo.strip()) > 3 or PATRON_FORMULA.search(trozo)]


# chunking -> palabras con carga semantica de una oracion
def _terminos(oracion: str) -> set[str]:
    palabras = re.findall(r"[a-záéíóúüñ]{4,}", _normalizar(oracion))
    return {palabra for palabra in palabras if palabra not in STOPWORDS}


# chunking -> cohesion lexica entre oraciones consecutivas
def _cohesion(anterior: str, siguiente: str) -> float:
    primero, segundo = _terminos(anterior), _terminos(siguiente)
    if not primero or not segundo:
        return 0.0
    return len(primero & segundo) / len(primero | segundo)


# fragmento -> corte por cambio de tema respetando el maximo
def _corte_duro(oraciones: list[str], max_size: int) -> list[str]:
    trozos: list[str] = []
    actual = ""
    for oracion in oraciones:
        while len(oracion) > max_size:
            if actual:
                trozos.append(actual.strip())
                actual = ""
            corte = oracion.rfind(" ", 0, max_size)
            corte = corte if corte >= max_size // 2 else max_size
            trozos.append(oracion[:corte].strip())
            oracion = oracion[corte:].strip()
        if actual and len(actual) + len(oracion) + 2 > max_size:
            trozos.append(actual.strip())
            actual = oracion
        else:
            actual = f"{actual} {oracion}".strip()
    if actual:
        trozos.append(actual.strip())
    return [trozo for trozo in trozos if trozo]


# fragmento -> division por cambios semanticos de tema
def _split_by_topic(oraciones: list[str], max_size: int, min_size: int, umbral: float) -> list[str]:
    grupos: list[str] = []
    actual: list[str] = []
    for oracion in oraciones:
        longitud = sum(len(item) for item in actual) + len(oracion)
        if actual and len("\n".join(actual)) >= min_size and _cohesion(actual[-1], oracion) < umbral:
            grupos.append("\n".join(actual).strip())
            actual = []
        actual.append(oracion)
        if longitud >= max_size:
            trozos = _corte_duro(actual, max_size)
            grupos.extend(trozos[:-1])
            actual = [trozos[-1]] if trozos else []
    if actual:
        grupos.append("\n".join(actual).strip())
    return [grupo for grupo in grupos if grupo]


# chunking -> deteccion de seccion de ejercicios o practicas
def _es_seccion_ejercicios(titulo: str, cuerpo: str) -> bool:
    if PATRON_SECCION_EJERCICIOS.search(titulo or ""):
        return True
    lineas = [linea.strip() for linea in cuerpo.splitlines() if linea.strip()]
    if len(lineas) < 2:
        return False
    marcadas = sum(1 for linea in lineas if PATRON_INICIO_EJERCICIO.match(linea))
    return marcadas >= 2 and marcadas / len(lineas) >= 0.5


# ejercicio -> puntuacion de complejidad estimada
def exercise_score(text: str) -> int:
    normalizado = _normalizar(text)
    puntuacion = 0
    if len(text) > 200:
        puntuacion += 1
    if len(text) > 400:
        puntuacion += 1
    if any(verbo in normalizado for verbo in VERBOS_DIFICILES):
        puntuacion += 2
    if any(verbo in normalizado for verbo in VERBOS_FACILES):
        puntuacion -= 1
    if PATRON_FORMULA.search(text):
        puntuacion += 1
    return puntuacion


# ejercicio -> separacion de items numerados de una seccion
def split_exercises(cuerpo: str) -> list[str]:
    items: list[str] = []
    actual: list[str] = []
    for linea in cuerpo.splitlines():
        if PATRON_INICIO_EJERCICIO.match(linea.strip()) and actual:
            items.append("\n".join(actual).strip())
            actual = []
        actual.append(linea)
    if actual:
        items.append("\n".join(actual).strip())
    return [item for item in items if len(item) > 15 or PATRON_FORMULA.search(item)]


# ejercicio -> seleccion de dificiles, faciles o representativo
def select_exercises(ejercicios: list[str], limite_representativo: int = 3) -> list[str]:
    if not ejercicios:
        return []
    puntuados = sorted(
        ((exercise_score(texto), indice, texto) for indice, texto in enumerate(ejercicios)),
        key=lambda item: (-item[0], item[1]),
    )
    if len(ejercicios) <= limite_representativo:
        return [puntuados[len(puntuados) // 2][2]]
    dificiles = [texto for _, _, texto in puntuados[:2]]
    faciles = [texto for _, _, texto in puntuados[-2:]]
    elegidos = set(dificiles) | set(faciles)
    return [texto for texto in ejercicios if texto in elegidos]


# fragmento -> chunking semantico por titulos y contexto
def split_chunks(text: str, max_size: int, max_chunks: int, min_size: int = 400, umbral: float = 0.12) -> list[SemanticChunk]:
    limpio = filter_noise(text)
    if not limpio:
        return []
    max_size = max(max_size, 500)
    min_size = max(min(max_size // 4, min_size), 120)
    fragmentos: list[SemanticChunk] = []
    secciones = _split_sections(limpio) or [("", 0, limpio)]
    for numero_seccion, (titulo, _nivel, cuerpo) in enumerate(secciones, 1):
        if _es_seccion_ejercicios(titulo, cuerpo):
            ejercicios = split_exercises(cuerpo)
            seleccion = select_exercises(ejercicios) if ejercicios else [cuerpo.strip()]
            for ejercicio in seleccion:
                fragmentos.append(SemanticChunk(ejercicio[:max_size], titulo, CATEGORIA_EJERCICIOS, meta={"seccion": numero_seccion}))
            continue
        for grupo in _split_by_topic(_oraciones(cuerpo), max_size, min_size, umbral):
            fragmentos.append(SemanticChunk(grupo, titulo, CATEGORIA_TEORIA, meta={"seccion": numero_seccion}))
    # chunking -> fusion de fragmentos teoricos demasiado cortos de la misma seccion
    fusionados: list[SemanticChunk] = []
    for fragmento in fragmentos:
        previo = fusionados[-1] if fusionados else None
        mismo_tema = previo and previo.meta.get("seccion") == fragmento.meta.get("seccion")
        if previo and mismo_tema and fragmento.category == CATEGORIA_TEORIA and previo.category == CATEGORIA_TEORIA and len(fragmento.text) < min_size and len(previo.text) + len(fragmento.text) + 2 <= max_size:
            previo.text = f"{previo.text}\n\n{fragmento.text}"
            continue
        fusionados.append(fragmento)
    fragmentos = fusionados
    limite = max(1, min(max_chunks, 6))
    ejercicios = [item for item in fragmentos if item.category == CATEGORIA_EJERCICIOS]
    teoria = [item for item in fragmentos if item.category == CATEGORIA_TEORIA]
    max_ejercicios = min(2, limite) if ejercicios else 0
    max_teoria = max(0, limite - max_ejercicios) if ejercicios else limite
    if len(ejercicios) > max_ejercicios:
        puntuados = sorted(ejercicios, key=lambda item: exercise_score(item.text))
        ejercicios = [puntuados[0], puntuados[-1]] if max_ejercicios > 1 else [puntuados[-1]]
    grupos_teoricos: list[SemanticChunk] = []
    if teoria and max_teoria:
        cantidad_grupos = min(max_teoria, len(teoria))
        for grupo in range(cantidad_grupos):
            inicio = round(grupo * len(teoria) / cantidad_grupos)
            fin = round((grupo + 1) * len(teoria) / cantidad_grupos)
            miembros = teoria[inicio:fin]
            titulos = list(dict.fromkeys(item.heading for item in miembros if item.heading))
            grupos_teoricos.append(SemanticChunk(
                text="\n\n".join(item.text for item in miembros),
                heading=" / ".join(titulos[:3]),
                category=CATEGORIA_TEORIA,
                meta={"secciones_fusionadas": len(miembros)},
            ))
    fragmentos = sorted(grupos_teoricos + ejercicios, key=lambda item: item.order)
    for orden, fragmento in enumerate(fragmentos, 1):
        fragmento.order = orden
    if len(fragmentos) > max_chunks:
        raise ValueError(f"El documento excede el máximo permitido de {max_chunks} fragmentos")
    return [fragmento for fragmento in fragmentos if fragmento.text]


# document -> secciones jerarquicas completas para la ruta de aprendizaje
def split_document_sections(text: str, max_size: int) -> list[SemanticChunk]:
    limpio = filter_noise(text)
    if not limpio:
        return []
    salida: list[SemanticChunk] = []
    ruta: dict[int, str] = {}
    for numero, (titulo, nivel, cuerpo) in enumerate(_split_sections(limpio) or [("Documento", 1, limpio)], 1):
        nivel = max(1, nivel or 1)
        ruta[nivel] = titulo or f"Seccion {numero}"
        ruta = {profundidad: nombre for profundidad, nombre in ruta.items() if profundidad <= nivel}
        encabezado = " / ".join(ruta[profundidad] for profundidad in sorted(ruta))
        piezas = _corte_duro(_oraciones(cuerpo), max(700, max_size))
        if not piezas:
            piezas = [cuerpo.strip()]
        for parte, contenido in enumerate(piezas, 1):
            if contenido:
                salida.append(SemanticChunk(
                    text=contenido,
                    heading=encabezado,
                    category=CATEGORIA_EJERCICIOS if _es_seccion_ejercicios(titulo, cuerpo) else CATEGORIA_TEORIA,
                    order=len(salida) + 1,
                    meta={"seccion": numero, "nivel": nivel, "parte": parte},
                ))
    return salida
