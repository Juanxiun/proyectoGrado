import math
import re
from html import escape


# visual -> ajuste de texto SVG en lineas para evitar desbordes
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
    return lines or [text[:max_chars_per_line]]


# visual -> mapa radial de conceptos respaldados
def _svg_concept_map(titulo: str, conceptos: list[str]) -> str:
    etiquetas = list(dict.fromkeys(str(item).strip() for item in conceptos if str(item).strip()))[:5] or [titulo[:30]]
    nodos, enlaces = [], []
    centro_x, centro_y = 205, 160

    titulo_lines = _wrap_svg_text(titulo, max_chars_per_line=18, max_lines=2)
    titulo_tspan = "".join(
        f'<tspan x="{centro_x}" dy="{14 if i > 0 else (0 if len(titulo_lines) == 1 else -6)}">{escape(line)}</tspan>'
        for i, line in enumerate(titulo_lines)
    )

    radio_x, radio_y = 125, 105
    for indice, etiqueta in enumerate(etiquetas):
        angulo = (2 * math.pi * indice / len(etiquetas)) - (math.pi / 2)
        x = max(80, min(330, centro_x + int(radio_x * math.cos(angulo))))
        y = max(45, min(275, centro_y + int(radio_y * math.sin(angulo))))
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


# visual -> diagrama pedagogico de pasos y resultado
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


# visual -> arbol conceptual con nodos y relaciones
def _svg_concept_tree(titulo: str, nodes: list[dict], edges: list[dict] | None = None) -> str:
    w, h = 500, 320
    root_x, root_y = 250, 36
    nodos_hijos = nodes[:6]
    ids = [str(nodo.get("id") or f"c{indice + 1}") for indice, nodo in enumerate(nodos_hijos)]
    posiciones: dict[str, tuple[int, int]] = {}
    for indice, identificador in enumerate(ids):
        fila, col = divmod(indice, 3)
        posiciones[identificador] = (85 + col * 165, 120 + fila * 90)

    enlaces_svg = []
    usados: set[tuple[str, str]] = set()
    for edge in edges or []:
        origen, destino = str(edge.get("source", "")), str(edge.get("target", ""))
        if origen not in posiciones or destino not in posiciones or origen == destino:
            continue
        if (origen, destino) in usados:
            continue
        usados.add((origen, destino))
        x1, y1 = posiciones[origen]
        x2, y2 = posiciones[destino]
        etiqueta = str(edge.get("label") or "se relaciona")[:18]
        enlaces_svg.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#94A3B8" stroke-width="1.8"/>'
            f'<text x="{(x1 + x2) // 2}" y="{(y1 + y2) // 2 - 6}" text-anchor="middle" font-size="8" font-family="system-ui, sans-serif" fill="#64748B">{escape(etiqueta)}</text>'
        )
    if not enlaces_svg:
        for hx, hy in posiciones.values():
            enlaces_svg.append(f'<line x1="{root_x}" y1="{root_y + 20}" x2="{hx}" y2="{hy - 24}" stroke="#CBD5E1" stroke-width="1.6"/>')

    hijos_svg = []
    for indice, nodo in enumerate(nodos_hijos):
        hx, hy = posiciones[ids[indice]]
        label_lines = _wrap_svg_text(str(nodo.get("label") or f"Concepto {indice + 1}"), max_chars_per_line=14, max_lines=2)
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
