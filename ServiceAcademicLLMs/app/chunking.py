import re


def split_chunks(text: str, size: int, overlap: int, max_chunks: int) -> list[str]:
    if not text.strip():
        return []
    size = max(size, 500)
    overlap = min(max(overlap, 0), size // 3)
    paragraphs = re.split(r"\n\s*\n|(?=^#{1,6}\s)|(?=^[A-ZÁÉÍÓÚÜÑ][^\n]{2,100}:\s*$)", text, flags=re.MULTILINE)
    chunks: list[str] = []
    current = ""
    for paragraph in (p.strip() for p in paragraphs if p.strip()):
        is_heading = paragraph.startswith("#") or (paragraph.endswith(":") and len(paragraph) <= 100)
        if is_heading and current:
            chunks.append(current)
            current = ""
        while len(paragraph) > size:
            if current:
                chunks.append(current)
                current = ""
            cut = paragraph.rfind(" ", 0, size)
            cut = cut if cut >= size // 2 else size
            chunks.append(paragraph[:cut].strip())
            paragraph = paragraph[max(0, cut - overlap):].strip()
        if len(current) + len(paragraph) + 2 <= size:
            current = f"{current}\n\n{paragraph}".strip()
        else:
            if current:
                chunks.append(current)
            carry = current[-overlap:] if overlap else ""
            current = f"{carry}\n{paragraph}".strip()
    if current:
        chunks.append(current)
    result = [chunk for chunk in chunks if chunk]
    if len(result) > max_chunks:
        raise ValueError(f"El documento excede el máximo permitido de {max_chunks} fragmentos")
    return result
