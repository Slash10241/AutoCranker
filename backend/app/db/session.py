"""Database session setup for AutoCranker."""

from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.db.models import Base


def _make_engine():
    url = get_settings().database_url
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args, echo=False)


# Created lazily on first use so config is already loaded.
_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = _make_engine()
    return _engine


def get_session_factory() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            bind=get_engine(), autocommit=False, autoflush=False
        )
    return _SessionLocal


def init_db() -> None:
    """Create all tables if they don't exist yet."""
    Base.metadata.create_all(bind=get_engine())


def migrate_db() -> None:
    """Apply additive schema migrations for columns added after initial deploy."""
    from sqlalchemy import text

    new_columns = [
        "ALTER TABLE repair_cases ADD COLUMN appointment_type VARCHAR(100)",
        "ALTER TABLE repair_cases ADD COLUMN calendar_notes TEXT",
        "ALTER TABLE garage_settings ADD COLUMN tax_rate REAL DEFAULT 0.21",
        "ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN attachment_url VARCHAR(500)",
        "ALTER TABLE messages ADD COLUMN attachment_filename VARCHAR(300)",
    ]
    engine = get_engine()
    with engine.connect() as conn:
        for sql in new_columns:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session per request."""
    factory = get_session_factory()
    db: Session = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
