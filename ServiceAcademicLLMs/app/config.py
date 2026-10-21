from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    port: int = 8890
    # LM Studio -> en Docker usa host.docker.internal, en local 127.0.0.1
    lmstudio_base_url: str = "http://host.docker.internal:1234"
    lmstudio_embedding_url: str | None = None
    lmstudio_gemma_model: str = "mistral-7b-instruct-v0.3"
    lmstudio_mistral_model: str = "mistral-7b-instruct-v0.3"
    lmstudio_embedding_model: str = "nomic-embed-text-v2-moe"
    # redis RAG (vectorial) -> contenedor redis_rag_server en puerto 6380
    redis_host: str = "redis_rag_server"
    redis_port: int = 6380
    redis_username: str = "default"
    redis_password: str = "AdminRagPass123"
    redis_db: int = 0
    # redis principal notificaciones -> en Docker usa host.docker.internal:6379
    notify_redis_host: str = "host.docker.internal"
    notify_redis_port: int = 6379
    notify_redis_username: str = "cache_user"
    notify_redis_password: str = "UserCachePass123"
    notify_redis_db: int = 0
    webhook_secret: str = "shalom-llm-dev"
    minio_endpoint: str = "http://host.docker.internal:9000"
    # chunking -> limite duro de caracteres por fragmento semantico
    chunk_size: int = 6000
    # chunking -> fragmento minimo antes de fusionar y cohesion lexica minima
    chunk_min_chars: int = 400
    chunk_semantic_threshold: float = 0.05
    max_chunks_per_document: int = 6
    llm_acceptance_threshold: float = 0.85
    llm_max_refinement_iterations: int = 2
    # LM Studio -> espera para generaciones largas
    llm_request_timeout: float = 1800.0
    # LM Studio -> timeout de conexion
    llm_connect_timeout: float = 30.0
    llm_max_concurrency: int = 4
    worker_count: int = 2
    pipeline_max_duration_sec: int = 540
    max_document_bytes: int = 157_286_400
    job_max_retries: int = 3
    quiz_advance_threshold: float = 0.80
    quiz_retain_threshold: float = 0.60


settings = Settings()
