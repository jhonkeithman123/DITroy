from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

COMPRESSION_MARKER = "[Earlier conversation compressed]"
LOGGER = logging.getLogger(__name__)


def estimate_tokens(text: str) -> int:
    """Estimate tokens without loading a model-specific tokenizer."""
    return max(1, (len(text) + 3) // 4) if text else 0


class MemoryStore(Protocol):
    def add(self, conversation_id: str, role: str, content: str) -> None: ...
    def remember(self, conversation_id: str, fact: str) -> None: ...
    def inherit_facts(self, source_conversation_id: str, target_conversation_id: str) -> None: ...
    def fact_count(self, conversation_id: str) -> int: ...
    def list_conversations(self) -> list[dict[str, Any]]: ...
    def history(self, conversation_id: str, limit: int = 200) -> list[dict[str, str]]: ...
    def capture_facts(self, conversation_id: str, content: str) -> list[str]: ...
    def context(self, conversation_id: str) -> str: ...


class SQLiteMemoryStore:
    def __init__(self, path: str | Path = "./data/memory.sqlite3", token_budget: int = 768):
        self.path = Path(path)
        self.token_budget = max(8, token_budget)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._migrate_from_legacy_json()
        self._initialize()

    def add(self, conversation_id: str, role: str, content: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO conversation_messages(conversation_id, role, content, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (conversation_id, role, content.strip(), self._now()),
            )

    def remember(self, conversation_id: str, fact: str) -> None:
        clean = fact.strip()
        if not clean:
            return
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO conversation_facts(conversation_id, fact, created_at)
                VALUES (?, ?, ?)
                """,
                (conversation_id, clean, self._now()),
            )

    def inherit_facts(self, source_conversation_id: str, target_conversation_id: str) -> None:
        with self._connect() as connection:
            facts = connection.execute(
                "SELECT fact FROM conversation_facts WHERE conversation_id = ?",
                (source_conversation_id,),
            ).fetchall()
            for row in facts:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO conversation_facts(conversation_id, fact, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (target_conversation_id, row[0], self._now()),
                )

    def fact_count(self, conversation_id: str) -> int:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT COUNT(*) FROM conversation_facts WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
        return int(row[0]) if row else 0

    def list_conversations(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    conversation_id,
                    MAX(created_at) AS updated_at,
                    COALESCE(
                        MIN(CASE WHEN role = 'user' THEN content END),
                        MIN(content),
                        'New chat'
                    ) AS title_source
                FROM conversation_messages
                GROUP BY conversation_id
                ORDER BY updated_at DESC
                """
            ).fetchall()

        return [
            {
                "conversation_id": row["conversation_id"],
                "title": self._trim_title(row["title_source"]),
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def history(self, conversation_id: str, limit: int = 200) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content, created_at
                FROM conversation_messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (conversation_id, max(1, limit)),
            ).fetchall()
        return [
            {"role": row["role"], "content": row["content"], "created_at": row["created_at"]}
            for row in rows
        ]

    def capture_facts(self, conversation_id: str, content: str) -> list[str]:
        quoted = re.findall(r'"([^"\n]+)"', content)
        facts = [f'Remembered word: "{value.strip()}"' for value in quoted if value.strip()]
        for fact in facts:
            self.remember(conversation_id, fact)
        return facts

    def context(self, conversation_id: str) -> str:
        facts = self._facts(conversation_id)
        recent = self._recent_messages(conversation_id)
        if not facts and not recent:
            return ""

        sections = []
        if facts:
            sections.append("Saved facts:\n" + "\n".join(f"- {fact}" for fact in facts))
        if recent:
            sections.append("Recent conversation:\n" + "\n".join(f"{m['role']}: {m['content']}" for m in recent))

        context = "\n\n".join(sections)
        if estimate_tokens(context) <= self.token_budget:
            return context

        budget_chars = self.token_budget * 4
        compressed = f"{COMPRESSION_MARKER}\n{context}"
        return compressed[:budget_chars].rstrip()

    def _recent_messages(self, conversation_id: str) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT role, content, created_at
                FROM conversation_messages
                WHERE conversation_id = ?
                ORDER BY created_at DESC
                LIMIT 40
                """,
                (conversation_id,),
            ).fetchall()
        messages = [
            {"role": row["role"], "content": row["content"], "created_at": row["created_at"]}
            for row in rows
        ]
        messages.reverse()
        while estimate_tokens("\n".join(f"{m['role']}: {m['content']}" for m in messages)) > self.token_budget and len(messages) > 1:
            messages.pop(0)
        return messages

    def _facts(self, conversation_id: str) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT fact FROM conversation_facts WHERE conversation_id = ? ORDER BY created_at ASC",
                (conversation_id,),
            ).fetchall()
        return [row["fact"] for row in rows]

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS conversation_facts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    fact TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(conversation_id, fact)
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON conversation_messages(conversation_id, created_at)"
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _trim_title(self, content: str) -> str:
        source = (content or "New chat").strip()
        return source[:52] + ("..." if len(source) > 52 else "")

    def _migrate_from_legacy_json(self) -> None:
        legacy_path = self.path.with_suffix(".json")
        if self.path.exists() or not legacy_path.exists():
            return

        import json

        try:
            with legacy_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return

        self._initialize()
        with self._connect() as connection:
            for conversation_id, payload in data.items():
                if isinstance(payload, list):
                    records = payload
                    facts = []
                elif isinstance(payload, dict):
                    records = payload.get("recent", [])
                    facts = payload.get("facts", [])
                else:
                    continue

                for fact in facts:
                    if isinstance(fact, str):
                        connection.execute(
                            "INSERT OR IGNORE INTO conversation_facts(conversation_id, fact, created_at) VALUES (?, ?, ?)",
                            (conversation_id, fact, self._now()),
                        )

                for record in records:
                    role = record.get("role") if isinstance(record, dict) else None
                    content = record.get("content") if isinstance(record, dict) else None
                    created_at = record.get("created_at") if isinstance(record, dict) else None
                    if role and content:
                        connection.execute(
                            "INSERT INTO conversation_messages(conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)",
                            (conversation_id, role, content.strip(), created_at or self._now()),
                        )


class SupabaseMemoryStore:
    def __init__(self, token_budget: int = 768, supabase_url: str = "", supabase_key: str = ""):
        self.token_budget = max(8, token_budget)
        self.supabase_url = (supabase_url or "").strip()
        self.supabase_key = (supabase_key or "").strip()
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase backend requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

        try:
            from supabase import create_client  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "Supabase backend selected but dependency is missing. Install with: pip install supabase"
            ) from exc

        self._client = create_client(self.supabase_url, self.supabase_key)
        LOGGER.warning(
            "Supabase memory backend is scaffolded but not fully implemented yet; "
            "switch back to MEMORY_BACKEND=sqlite for production use today."
        )

    def add(self, conversation_id: str, role: str, content: str) -> None:
        raise NotImplementedError("Supabase adapter method add() is not implemented yet")

    def remember(self, conversation_id: str, fact: str) -> None:
        raise NotImplementedError("Supabase adapter method remember() is not implemented yet")

    def inherit_facts(self, source_conversation_id: str, target_conversation_id: str) -> None:
        raise NotImplementedError("Supabase adapter method inherit_facts() is not implemented yet")

    def fact_count(self, conversation_id: str) -> int:
        raise NotImplementedError("Supabase adapter method fact_count() is not implemented yet")

    def list_conversations(self) -> list[dict[str, Any]]:
        raise NotImplementedError("Supabase adapter method list_conversations() is not implemented yet")

    def history(self, conversation_id: str, limit: int = 200) -> list[dict[str, str]]:
        raise NotImplementedError("Supabase adapter method history() is not implemented yet")

    def capture_facts(self, conversation_id: str, content: str) -> list[str]:
        quoted = re.findall(r'"([^"\n]+)"', content)
        facts = [f'Remembered word: "{value.strip()}"' for value in quoted if value.strip()]
        for fact in facts:
            self.remember(conversation_id, fact)
        return facts

    def context(self, conversation_id: str) -> str:
        raise NotImplementedError("Supabase adapter method context() is not implemented yet")


class LocalMemoryStore(SQLiteMemoryStore):
    """Compatibility name retained for existing imports/tests."""


def create_memory_store(
    *,
    backend: str,
    path: str | Path,
    token_budget: int,
    supabase_url: str = "",
    supabase_service_role_key: str = "",
) -> MemoryStore:
    backend_name = (backend or "sqlite").strip().lower()
    if backend_name == "sqlite":
        return SQLiteMemoryStore(path=path, token_budget=token_budget)
    if backend_name == "supabase":
        return SupabaseMemoryStore(
            token_budget=token_budget,
            supabase_url=supabase_url,
            supabase_key=supabase_service_role_key,
        )
    raise ValueError(f"Unsupported MEMORY_BACKEND '{backend_name}'. Use 'sqlite' or 'supabase'.")
