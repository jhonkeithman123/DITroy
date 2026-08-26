from __future__ import annotations

import json
import os
import re
import tempfile
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


COMPRESSION_MARKER = "[Earlier conversation compressed]"


def estimate_tokens(text: str) -> int:
    """Estimate tokens without loading a model-specific tokenizer."""
    return max(1, (len(text) + 3) // 4) if text else 0


class LocalMemoryStore:
    def __init__(self, path: str | Path = "./data/memory.json", token_budget: int = 768):
        self.path = Path(path)
        self.token_budget = max(8, token_budget)

    def add(self, conversation_id: str, role: str, content: str) -> None:
        records = self._read()
        conversation = self._conversation(records, conversation_id)
        conversation["recent"].append(
            {"role": role, "content": content.strip(), "created_at": datetime.now(timezone.utc).isoformat()}
        )
        self._compress_recent(conversation)
        self._write(records)

    def remember(self, conversation_id: str, fact: str) -> None:
        records = self._read()
        conversation = self._conversation(records, conversation_id)
        if fact.strip() and fact.strip() not in conversation["facts"]:
            conversation["facts"].append(fact.strip())
        self._write(records)

    def inherit_facts(self, source_conversation_id: str, target_conversation_id: str) -> None:
        records = self._read()
        source = self._conversation(records, source_conversation_id)
        target = self._conversation(records, target_conversation_id)
        for fact in source["facts"]:
            if fact not in target["facts"]:
                target["facts"].append(deepcopy(fact))
        self._write(records)

    def fact_count(self, conversation_id: str) -> int:
        return len(self._conversation(self._read(), conversation_id)["facts"])

    def list_conversations(self) -> list[dict[str, Any]]:
        conversations = []
        for conversation_id, raw_conversation in self._read().items():
            conversation = self._conversation({conversation_id: raw_conversation}, conversation_id)
            recent = conversation["recent"]
            if not recent:
                continue
            latest = recent[-1]
            user_messages = [message for message in recent if message.get("role") == "user"]
            title_source = user_messages[0]["content"] if user_messages else latest["content"]
            conversations.append(
                {
                    "conversation_id": conversation_id,
                    "title": title_source[:52] + ("..." if len(title_source) > 52 else ""),
                    "updated_at": latest.get("created_at", ""),
                }
            )
        return sorted(conversations, key=lambda item: item["updated_at"], reverse=True)

    def capture_facts(self, conversation_id: str, content: str) -> list[str]:
        quoted = re.findall(r'"([^"\n]+)"', content)
        facts = [f'Remembered word: "{value.strip()}"' for value in quoted if value.strip()]
        for fact in facts:
            self.remember(conversation_id, fact)
        return facts

    def context(self, conversation_id: str) -> str:
        conversation = self._conversation(self._read(), conversation_id)
        facts = conversation["facts"]
        recent = conversation["recent"]
        summary = conversation["summary"]
        if not facts and not recent and not summary:
            return ""

        sections = []
        if facts:
            sections.append("Saved facts:\n" + "\n".join(f"- {fact}" for fact in facts))
        if summary:
            sections.append(f"Compressed summary:\n{summary}")
        if recent:
            sections.append("Recent conversation:\n" + "\n".join(f"{message['role']}: {message['content']}" for message in recent))
        context = "\n\n".join(sections)
        if estimate_tokens(context) <= self.token_budget:
            return context

        budget_chars = self.token_budget * 4
        compressed = f"{COMPRESSION_MARKER}\n{context}"
        return compressed[:budget_chars].rstrip()

    def _conversation(self, records: dict[str, Any], conversation_id: str) -> dict[str, Any]:
        current = records.setdefault(conversation_id, {})
        if isinstance(current, list):
            current = {"facts": [], "summary": "", "recent": current}
            records[conversation_id] = current
        current.setdefault("facts", [])
        current.setdefault("summary", "")
        current.setdefault("recent", [])
        return current

    def _compress_recent(self, conversation: dict[str, Any]) -> None:
        lines = [f"{message['role']}: {message['content']}" for message in conversation["recent"]]
        while estimate_tokens("\n".join(lines)) > self.token_budget and len(lines) > 1:
            removed = lines.pop(0)
            previous = conversation.get("summary", "")
            conversation["summary"] = (f"{previous} {removed}").strip()[-self.token_budget * 2 :]
            conversation["recent"].pop(0)

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _write(self, records: dict[str, list[dict[str, Any]]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_path = tempfile.mkstemp(dir=self.path.parent, prefix="memory-", suffix=".tmp")
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as file:
                json.dump(records, file, ensure_ascii=True, separators=(",", ":"))
            os.replace(temporary_path, self.path)
        finally:
            if os.path.exists(temporary_path):
                os.remove(temporary_path)
