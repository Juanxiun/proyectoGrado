from redis.asyncio import Redis

from app.config import settings


def create_redis_connection() -> Redis:
    """Conecta al Redis Stack publicado por el compose de infraestructura de Windows."""
    return Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        username=settings.redis_username or None,
        password=settings.redis_password or None,
        db=settings.redis_db,
        decode_responses=False,
        socket_connect_timeout=3,
        socket_timeout=5,
        health_check_interval=30,
    )
