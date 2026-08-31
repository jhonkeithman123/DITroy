from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from ditroy.config import DitroyConfig
from ditroy.identity import DEFAULT_AI_IDENTITY, build_chat_prompt
from ditroy.services.memory import MemoryStore, create_memory_store
from ditroy.services.model_client import ModelClient, create_model_client

logger = logging.getLogger(__name__)


@dataclass
class ChatResult:
    reply: str
    conversation_id: str


@dataclass
class ConversationResult:
    conversation_id: str
    inherited_facts: int


class DitroyEngine:
    """The central Ditroy AI Cognitive Engine.

    Encapsulates the complete AI pipeline:
      - Memory & token budgeting
      - Fact extraction & cross-conversation inheritance
      - Identity injection & prompt synthesis
      - Model inference & error handling
      - History tracking & persistence
    """

    def __init__(
        self,
        config: DitroyConfig | None = None,
        model_client: ModelClient | None = None,
        memory_store: MemoryStore | None = None,
        identity: str | None = None,
    ) -> None:
        self.config = config or DitroyConfig.from_env()
        self.identity = identity or DEFAULT_AI_IDENTITY

        self.model_client = model_client or create_model_client(
            provider=self.config.model_provider,
            model=self.config.model_name,
            base_url=self.config.ollama_base_url,
            groq_api_key=self.config.groq_api_key,
        )

        self.memory_store = memory_store or create_memory_store(
            backend=self.config.memory_backend,
            path=self.config.memory_path,
            token_budget=self.config.memory_token_budget,
            supabase_url=self.config.supabase_url,
            supabase_service_role_key=self.config.supabase_service_role_key,
        )

    def chat(
        self,
        message: str,
        conversation_id: str = "default",
        user_id: str | None = None,
    ) -> ChatResult:
        """Run the full chat pipeline for an incoming user message."""
        prompt = message.strip()
        if not prompt:
            raise ValueError("Message must not be empty.")

        # 1. Capture quoted facts into long-term memory
        self.memory_store.capture_facts(conversation_id, prompt)

        # 2. Retrieve compiled context within token budget
        previous_context = self.memory_store.context(conversation_id)

        # 3. Build synthesized prompt
        model_prompt = build_chat_prompt(
            identity=self.identity,
            previous_context=previous_context,
            user_prompt=prompt,
        )

        # 4. Generate reply via model client
        reply = self.model_client.generate(model_prompt)

        # 5. Persist turns into memory store
        try:
            self.memory_store.add(conversation_id, "user", prompt, user_id=user_id)
            self.memory_store.add(conversation_id, "assistant", reply, user_id=user_id)
        except TypeError:
            self.memory_store.add(conversation_id, "user", prompt)
            self.memory_store.add(conversation_id, "assistant", reply)

        return ChatResult(reply=reply, conversation_id=conversation_id)

    def create_conversation(
        self,
        source_conversation_id: str = "default",
        user_id: str | None = None,
    ) -> ConversationResult:
        """Create a new conversation session inheriting facts from a source conversation."""
        new_id = str(uuid4())
        self.memory_store.inherit_facts(source_conversation_id, new_id)
        inherited_facts = self.memory_store.fact_count(new_id)
        return ConversationResult(conversation_id=new_id, inherited_facts=inherited_facts)

    def list_conversations(self) -> list[dict[str, Any]]:
        """List past conversations with preview titles and timestamps."""
        return self.memory_store.list_conversations()

    def get_messages(self, conversation_id: str, limit: int = 200) -> list[dict[str, str]]:
        """Get message history for a conversation."""
        safe_limit = min(max(1, limit), 1000)
        return self.memory_store.history(conversation_id, limit=safe_limit)

    def remember(self, conversation_id: str, fact: str) -> None:
        """Explicitly remember a fact for a conversation."""
        self.memory_store.remember(conversation_id, fact)

    def capture_facts(self, conversation_id: str, content: str) -> list[str]:
        """Extract and store facts from content."""
        return self.memory_store.capture_facts(conversation_id, content)

    def inherit_facts(self, source_conversation_id: str, target_conversation_id: str) -> None:
        """Inherit facts from one conversation to another."""
        self.memory_store.inherit_facts(source_conversation_id, target_conversation_id)

    def fact_count(self, conversation_id: str) -> int:
        """Count saved facts for a conversation."""
        return self.memory_store.fact_count(conversation_id)

    def context(self, conversation_id: str) -> str:
        """Get compiled context for a conversation."""
        return self.memory_store.context(conversation_id)

    def health_check(self) -> dict[str, Any]:
        """Check status of model client and backend services."""
        model_status = self.model_client.health_check()
        return {
            "status": "ok",
            "service": "ditroy-engine",
            "mode": "local-model",
            "provider": model_status.get("provider", self.config.model_provider),
            "model": model_status.get("model", self.config.model_name),
            "model_status": model_status.get("status", "degraded"),
        }
