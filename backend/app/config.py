"""Application settings loaded from environment / .env file."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DEFAULT_DB_PATH = (_BACKEND_DIR / "autocranker.db").as_posix()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    make_webhook_secret: str = Field(
        default="",
        description="Shared secret expected in the X-Bot-Secret header from Make.",
    )
    frontend_api_key: str = Field(
        default="",
        description=(
            "Optional API key for /api/chat. If empty, no auth is required (local dev)."
        ),
    )
    debug: bool = Field(
        default=False,
        description="If true, enables the /debug/echo endpoint.",
    )
    app_name: str = Field(
        default="AutoCranker",
        description="Application name used in prompts and fallback replies.",
    )
    gemini_api_key: str = Field(
        default="",
        description="Google Gemini API key. If empty, fallback replies are used.",
    )
    gemini_model: str = Field(
        default="gemini-2.0-flash",
        description="Gemini model used for conversation.",
    )
    llm_enabled: bool = Field(
        default=True,
        description="If false, bypasses Gemini and uses fallback replies.",
    )
    database_url: str = Field(
        default=f"sqlite:///{_DEFAULT_DB_PATH}",
        description="SQLAlchemy database URL. Defaults to backend/autocranker.db.",
    )
    demo_customer_session_id: str = Field(
        default="demo_leo_ekl7",
        description="Mock WhatsApp session id that receives outbound quotations.",
    )
    uploads_dir: str = Field(
        default=str(_BACKEND_DIR / "uploads"),
        description="Directory for uploaded quote PDFs and other files.",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
