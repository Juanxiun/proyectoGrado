import logging
from fastapi import APIRouter, Header, HTTPException, Request, Response
from app.routers.security import require_internal_secret

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/preview/pdf", tags=["pdf-preview"])


# preview -> metadatos de paginas para visor embebido
@router.post("/info")
async def pdf_preview_info(request: Request, x_webhook_secret: str | None = Header(default=None)):
    require_internal_secret(x_webhook_secret)
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo PDF está vacío")
    try:
        import pymupdf as fitz
        with fitz.open(stream=data, filetype="pdf") as pdf:
            if pdf.page_count == 0:
                raise ValueError("El PDF no contiene páginas")
            rect = pdf.load_page(0).rect
            return {"paginas": pdf.page_count, "ancho": round(rect.width, 2), "alto": round(rect.height, 2)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("No se pudo leer el PDF para vista previa: %s", exc)
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido") from exc


# preview -> render de pagina individual como jpeg
@router.post("/pagina/{numero}")
async def pdf_preview_page(
    numero: int,
    request: Request,
    zoom: float = 1.6,
    x_webhook_secret: str | None = Header(default=None),
):
    require_internal_secret(x_webhook_secret)
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo PDF está vacío")
    try:
        import pymupdf as fitz
        with fitz.open(stream=data, filetype="pdf") as pdf:
            total = pdf.page_count
            if total == 0:
                raise ValueError("El PDF no contiene páginas")
            indice = min(max(numero, 1), total) - 1
            pagina = pdf.load_page(indice)
            escala = min(max(zoom, 0.8), 3.0)
            pix = pagina.get_pixmap(matrix=fitz.Matrix(escala, escala), alpha=False)
            imagen = pix.tobytes("jpeg", jpg_quality=72)
            return Response(
                content=imagen,
                media_type="image/jpeg",
                headers={
                    "X-Total-Pages": str(total),
                    "X-Page-Number": str(indice + 1),
                    "X-Page-Width": str(round(pagina.rect.width, 2)),
                    "X-Page-Height": str(round(pagina.rect.height, 2)),
                    "Cache-Control": "private, max-age=3600",
                },
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("No se pudo renderizar la pagina %s del PDF: %s", numero, exc)
        raise HTTPException(status_code=400, detail="No se pudo generar la vista previa del PDF") from exc
