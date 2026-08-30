from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class DitroyConfig:
    """Configuration for Ditroy AI Engine."""

    model_provider: str = "ollama"
    model_name: str = "llama3.2"
    ollama_base_url: str = "http://127.0.0.1:11434"
    model_path: str = ""
    offload_dir: str = "./.offload"
    max_tokens: int = 512
    context_tokens: int = 1024
    enable_rag: bool = False
    embedding_model: str = "all-MiniLM-L6-v2"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    memory_backend: str = "sqlite"
    memory_path: str | Path = "./data/memory.sqlite3"
    memory_token_budget: int = 768
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    @classmethod
    def from_env(cls) -> DitroyConfig:
        """Create DitroyConfig loaded from environment variables."""
        return cls(
            model_provider=os.getenv("MODEL_PROVIDER", "ollama"),
            model_name=os.getenv("MODEL_NAME", os.getenv("OLLAMA_MODEL", "llama3.2")),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            model_path=os.getenv("MODEL_PATH", ""),
            offload_dir=os.getenv("OFFLOAD_DIR", "./.offload"),
            max_tokens=int(os.getenv("MAX_TOKENS", "512")),
            context_tokens=int(os.getenv("CONTEXT_TOKENS", "1024")),
            enable_rag=os.getenv("ENABLE_RAG", "false").lower() == "true",
            embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            api_host=os.getenv("API_HOST", "0.0.0.0"),
            api_port=int(os.getenv("API_PORT", "8000")),
            memory_backend=os.getenv("MEMORY_BACKEND", "sqlite"),
            memory_path=os.getenv("MEMORY_PATH", "./data/memory.sqlite3"),
            memory_token_budget=int(os.getenv("MEMORY_TOKEN_BUDGET", "768")),
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        )
