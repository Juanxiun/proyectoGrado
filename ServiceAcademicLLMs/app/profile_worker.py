import asyncio
import json
import logging
import socket

from app.config import settings
from app.ollama import OllamaClient
from app.RAG.repository import RAGRepository
from app.services.student_learning import update_student_profile

logger = logging.getLogger(__name__)


async def run_profile_worker(repo: RAGRepository, llm: OllamaClient, semaphore, stop: asyncio.Event) -> None:
    consumer = f"profile-{socket.gethostname()}-{id(asyncio.current_task())}"
    while not stop.is_set():
        try:
            await repo.ensure_consumer_group(repo.profile_stream, repo.profile_group)
            break
        except Exception as exc:
            logger.warning("Redis RAG aun no esta listo para perfiles: %s", exc)
            await asyncio.sleep(2)
    while not stop.is_set():
        try:
            messages = await repo.read_messages(repo.profile_stream, repo.profile_group, consumer)
            for message_id, fields in messages:
                student_id = fields[b"student_id"].decode()
                content_id = fields[b"content_id"].decode()
                batch_number = int(fields[b"batch_number"])
                try:
                    await update_student_profile(student_id, content_id, batch_number, repo, llm, semaphore)
                    await repo.acknowledge(repo.profile_stream, repo.profile_group, message_id)
                except Exception as exc:
                    logger.exception("No se pudo actualizar perfil student_id=%s content_id=%s batch=%s", student_id, content_id, batch_number)
                    attempts = await repo.increment_profile_job_attempts(student_id, content_id, batch_number)
                    if attempts >= settings.job_max_retries:
                        await repo.set_profile_job_status(student_id, content_id, batch_number, "FAILED", str(exc)[:1000])
                        await repo.acknowledge(repo.profile_stream, repo.profile_group, message_id)
                    else:
                        await repo.retry_profile(student_id, content_id, batch_number)
                        await repo.acknowledge(repo.profile_stream, repo.profile_group, message_id)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Error del worker de perfiles pedagógicos")
            await asyncio.sleep(2)
