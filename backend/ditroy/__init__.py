from __future__ import annotations

from ditroy.config import DitroyConfig
from ditroy.engine import ChatResult, ConversationResult, DitroyEngine
from ditroy.identity import DEFAULT_AI_IDENTITY, build_chat_prompt
from ditroy.services.memory import (
    LocalMemoryStore,
    MemoryStore,
    SQLiteMemoryStore,
    SupabaseMemoryStore,
    create_memory_store,
    estimate_tokens,
)
from ditroy.services.model_client import (
    CascadeModelClient,
    CustomOllamaClient,
    DeepSeekModelClient,
    GeminiModelClient,
    GroqModelClient,
    LocalOllamaClient,
    ModelClient,
    OpenRouterModelClient,
    StubModelClient,
    ZAIModelClient,
    create_model_client,
)

__version__ = "0.2.0"

__all__ = [
    "DitroyEngine",
    "DitroyConfig",
    "ChatResult",
    "ConversationResult",
    "DEFAULT_AI_IDENTITY",
    "build_chat_prompt",
    "ModelClient",
    "LocalOllamaClient",
    "CustomOllamaClient",
    "GroqModelClient",
    "GeminiModelClient",
    "DeepSeekModelClient",
    "ZAIModelClient",
    "OpenRouterModelClient",
    "CascadeModelClient",
    "StubModelClient",
    "create_model_client",
    "MemoryStore",
    "SQLiteMemoryStore",
    "SupabaseMemoryStore",
    "LocalMemoryStore",
    "create_memory_store",
    "estimate_tokens",
]
