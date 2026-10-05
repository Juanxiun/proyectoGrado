from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    port: int = 8890
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_gemma_model: str = "gemma4:e4b"
    ollama_mistral_model: str = "mistral:7b"
    ollama_embedding_model: str = "nomic-embed-text:latest"
    redis_host: str = "127.0.0.1"
    redis_port: int = 6380
    redis_username: str = "default"
    redis_password: str = "AdminRagPass123"
    redis_db: int = 0
    webhook_secret: str = ""
    minio_endpoint: str = "http://host.docker.internal:9000"
    chunk_size: int = 6000
    chunk_overlap: int = 500
    max_chunks_per_document: int = 200
    llm_acceptance_threshold: float = 0.97
    llm_max_refinement_iterations: int = 3
    llm_request_timeout: float = 240.0
    llm_max_concurrency: int = 2
    worker_count: int = 1
    max_document_bytes: int = 157_286_400
    job_max_retries: int = 3
    quiz_advance_threshold: float = 0.80
    quiz_retain_threshold: float = 0.60


settings = Settings()
