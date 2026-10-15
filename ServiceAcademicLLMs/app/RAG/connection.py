from redis.asyncio import Redis

from app.config import settings


# rag -> auth solo si hay password configurada
def _build_redis(username: str, password: str) -> dict:
    if password:
        return {"username": username, "password": password}
    return {}


# rag -> conexion al Redis Stack del compose de infraestructura
def create_redis_connection() -> Redis:
    auth = _build_redis(settings.redis_username, settings.redis_password)
    return Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        **auth,
        db=settings.redis_db,
        decode_responses=False,
        socket_connect_timeout=10,
        socket_timeout=60,
        health_check_interval=30,
    )


# rag -> conexion al Redis principal de notificaciones
def create_notify_redis_connection() -> Redis:
    auth = _build_redis(settings.notify_redis_username, settings.notify_redis_password)
    return Redis(
        host=settings.notify_redis_host,
        port=settings.notify_redis_port,
        **auth,
        db=settings.notify_redis_db,
        decode_responses=False,
        socket_connect_timeout=10,
        socket_timeout=60,
        health_check_interval=30,
    )
