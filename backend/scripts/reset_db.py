"""Wipe transactional data and re-seed one demo brake-noise case.

Run from anywhere (uses absolute DB path):

    uv run --project backend python backend/scripts/reset_db.py

Or from the backend folder:

    uv run python scripts/reset_db.py

On Windows you can also double-click / run:  .\\reset-db.ps1
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure `app` imports resolve when invoked from repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from sqlalchemy import text

from app.config import get_settings
from app.db.seed import seed_demo_data
from app.db.session import get_engine, get_session_factory, init_db


def main() -> None:
    db_path = _BACKEND_DIR / "autocranker.db"
    settings = get_settings()
    print(f"Database: {db_path}")
    print(f"URL:      {settings.database_url}")

    init_db()
    engine = get_engine()
    tables = [
        "quotation_items",
        "quotations",
        "inspections",
        "messages",
        "repair_cases",
        "vehicles",
        "customers",
    ]
    with engine.connect() as conn:
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        for table in tables:
            conn.execute(text(f"DELETE FROM {table}"))
        conn.commit()
        conn.execute(text("PRAGMA foreign_keys = ON"))

    factory = get_session_factory()
    with factory() as db:
        seed_demo_data(db)

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, title, status FROM repair_cases ORDER BY id")
        ).fetchall()

    if len(rows) != 1 or rows[0][1] != "Brake noise":
        print("ERROR: expected exactly one 'Brake noise' case.", file=sys.stderr)
        print(f"Found: {rows}", file=sys.stderr)
        sys.exit(1)

    print(f"OK: {len(rows)} case — id={rows[0][0]} title={rows[0][1]!r} status={rows[0][2]}")
    print("Refresh the dashboard and clear browser localStorage key 'garageos.v1' if old cases still appear.")


if __name__ == "__main__":
    main()
