import hmac
from fastapi import HTTPException
from app.config import settings


# LLM -> validacion de secreto interno entre microservicios
def require_internal_secret(presented: str | None) -> None:
    expected = settings.webhook_secret or "shalom-llm-dev"
    if presented is None or not hmac.compare_digest(presented, expected):
        raise HTTPException(status_code=401, detail="Token interno inválido")
