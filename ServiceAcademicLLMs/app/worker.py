import asyncio
import json
import logging
import random
import socket

import httpx
from app.config import settings
from app.ollama import OllamaClient
from app.pipeline import process_content
from app.RAG.repository import RAGRepository

logger = logging.getLogger(__name__)
async def run_worker(repo: RAGRepository, llm: OllamaClient, semaphore: asyncio.Semaphore, stop: asyncio.Event) -> None:
    consumer = f"{socket.gethostname()}-{id(asyncio.current_task())}"
    while not stop.is_set():
        try:
            await repo.ensure_consumer_group(repo.content_stream, repo.content_group)
            break
        except Exception as exc:
            if "BUSYGROUP" in str(exc):
                break
            logger.warning("Redis Stream no disponible al iniciar worker: %s", exc)
            await asyncio.sleep(2)
    async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=10), limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)) as http:
        while not stop.is_set():
            try:
                messages = await repo.read_messages(repo.content_stream, repo.content_group, consumer)
                if not messages:
                    continue
                for message_id, fields in messages:
                    content_id = fields.get(b"content_id", b"").decode()
                    status = await repo.job_status(content_id)
                    if not status or status.get("status") == "COMPLETED":
                        await repo.acknowledge(repo.content_stream, repo.content_group, message_id)
                        continue
                    attempts = int(status.get("attempts", "0")) + 1
                    await repo.update_job(content_id, status="PROCESSING", attempts=str(attempts), error="")
                    try:
                        event = json.loads(status.get("event", "{}"))
                        await process_content(content_id, event, repo, llm, http, semaphore)
                        await repo.acknowledge(repo.content_stream, repo.content_group, message_id)
                    except Exception as exc:
                        logger.exception("Procesamiento LLM falló job_id=%s attempt=%s", content_id, attempts)
                        if attempts >= settings.job_max_retries:
                            await repo.update_job(content_id, status="FAILED", error=str(exc)[:1000])
                            await repo.mark_content_state(content_id, "failed")
                            await repo.acknowledge(repo.content_stream, repo.content_group, message_id)
                        else:
                            await repo.update_job(content_id, status="RETRYING", error=str(exc)[:1000])
                            await asyncio.sleep(min(2 ** attempts + random.random(), 60))
                            await repo.retry_content(content_id)
                            await repo.acknowledge(repo.content_stream, repo.content_group, message_id)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Error del worker de documentos; se reintentará")
                await asyncio.sleep(2)
