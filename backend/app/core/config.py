from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "LearnOn"
    app_env: str = "development"
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 10080  # 7 days

    # Database
    database_url: str = "sqlite+aiosqlite:///./learnon.db"

    # AI / LLM
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 2048

    # Upload
    upload_dir: str = "../uploads"
    max_upload_size_mb: int = 50
    allowed_extensions: str = ".pdf"

    # Vector store
    vector_store_path: str = "./vectorstore"
    chunk_size: int = 500
    chunk_overlap: int = 50

    # ML
    ml_models_path: str = "./ml_models"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Rate limiting
    rate_limit_per_minute: int = 60

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
