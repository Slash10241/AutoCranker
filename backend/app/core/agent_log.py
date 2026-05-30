"""Terminal logging for agent runs (dev debugging only)."""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import Any

logger = logging.getLogger("app.agent")

_PREVIEW = 600


def _to_jsonable(val: Any) -> Any:
    if is_dataclass(val) and not isinstance(val, type):
        return {k: _to_jsonable(v) for k, v in asdict(val).items()}
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: _to_jsonable(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_to_jsonable(v) for v in val]
    return val


def _preview(val: Any) -> str:
    if val is None:
        return ""
    if is_dataclass(val) or isinstance(val, (dict, list)):
        text = json.dumps(_to_jsonable(val), ensure_ascii=False, default=str)
    else:
        text = str(val)
    if len(text) > _PREVIEW:
        return text[:_PREVIEW] + f"… (+{len(text) - _PREVIEW} chars)"
    return text


def log_agent_run(agent: str, label: str, **fields: Any) -> None:
    logger.info("── %s %s ──", agent, label)
    for key, val in fields.items():
        if val is not None and val != "":
            logger.info("  %s: %s", key, _preview(val))
