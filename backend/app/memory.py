"""In-memory store for message dedup and per-user conversation history.

Singleton lifetime is the lifetime of the FastAPI process. When the process
restarts, memory is gone. Replace with SQLite/Postgres to persist across
restarts; the public surface should stay the same.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Literal, Optional

Role = Literal["user", "bot"]

_MAX_DEDUP = 1000
_MAX_HISTORY_PER_USER = 20


@dataclass
class Turn:
    role: Role
    text: str
    ts: float = field(default_factory=time.time)


class InMemoryStore:
    def __init__(
        self,
        max_dedup: int = _MAX_DEDUP,
        max_history_per_user: int = _MAX_HISTORY_PER_USER,
    ) -> None:
        self._lock = threading.Lock()
        self._seen_ids: Deque[str] = deque(maxlen=max_dedup)
        self._seen_ids_set: set[str] = set()
        self._history: Dict[str, Deque[Turn]] = {}
        self._max_history_per_user = max_history_per_user

    def already_seen(self, message_id: Optional[str]) -> bool:
        if not message_id:
            return False
        with self._lock:
            return message_id in self._seen_ids_set

    def mark_seen(self, message_id: Optional[str]) -> None:
        if not message_id:
            return
        with self._lock:
            if message_id in self._seen_ids_set:
                return
            if len(self._seen_ids) == self._seen_ids.maxlen:
                evicted = self._seen_ids[0]
                self._seen_ids_set.discard(evicted)
            self._seen_ids.append(message_id)
            self._seen_ids_set.add(message_id)

    def append_turn(self, user_id: str, role: Role, text: str) -> None:
        with self._lock:
            buf = self._history.get(user_id)
            if buf is None:
                buf = deque(maxlen=self._max_history_per_user)
                self._history[user_id] = buf
            buf.append(Turn(role=role, text=text))

    def get_history(self, user_id: str) -> List[Turn]:
        with self._lock:
            buf = self._history.get(user_id)
            return list(buf) if buf else []

    def clear_dedup(self) -> None:
        with self._lock:
            self._seen_ids.clear()
            self._seen_ids_set.clear()

    def clear_session(self, user_id: str) -> None:
        with self._lock:
            self._history.pop(user_id, None)


_store_singleton: Optional[InMemoryStore] = None


def get_store() -> InMemoryStore:
    global _store_singleton
    if _store_singleton is None:
        _store_singleton = InMemoryStore()
    return _store_singleton
