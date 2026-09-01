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
    max_tokens: int = 2048
    context_tokens: int = 4096
    enable_rag: bool = False
    embedding_model: str = "all-MiniLM-L6-v2"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    memory_backend: str = "sqlite"
    memory_path: str | Path = "./data/memory.sqlite3"
    memory_token_budget: int = 2048
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    groq_api_key: str = ""
    gemini_api_key: str = ""
    deepseek_api_key: str = ""
    zai_api_key: str = ""
    openrouter_api_key: str = ""
    fallback_providers: str = "groq,gemini,deepseek,zai,openrouter,ollama"
    cron_secret: str = ""

    @classmethod
    def from_env(cls, env_file: str | Path | None = None) -> DitroyConfig:
        """Create DitroyConfig loaded from environment variables and local .env files."""
        # Auto-discover and load .env if present
        candidates = [Path(env_file)] if env_file else [
            Path(".env"),
            Path("backend/.env"),
            Path(__file__).resolve().parents[2] / ".env",
            Path(__file__).resolve().parents[1] / ".env",
        ]
        for candidate in candidates:
            if candidate and candidate.is_file():
                try:
                    for line in candidate.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
                except Exception:
                    pass
                break

        provider = os.getenv("MODEL_PROVIDER", "ollama")
        provider_lower = provider.lower()

        if provider_lower == "groq":
            default_model = "llama-3.3-70b-versatile"
        elif provider_lower == "gemini":
            default_model = "gemini-2.0-flash"
        elif provider_lower == "deepseek":
            default_model = "deepseek-chat"
        elif provider_lower in ("zai", "zhipu"):
            default_model = "glm-4-flash"
        elif provider_lower == "openrouter":
            default_model = "meta-llama/llama-3.3-70b-instruct:free"
        else:
            default_model = "llama3.2"

        return cls(
            model_provider=provider,
            model_name=os.getenv("MODEL_NAME", os.getenv("OLLAMA_MODEL", default_model)),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            model_path=os.getenv("MODEL_PATH", ""),
            offload_dir=os.getenv("OFFLOAD_DIR", "./.offload"),
            max_tokens=int(os.getenv("MAX_TOKENS", "2048")),
            context_tokens=int(os.getenv("CONTEXT_TOKENS", "4096")),
            enable_rag=os.getenv("ENABLE_RAG", "false").lower() == "true",
            embedding_model=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            api_host=os.getenv("API_HOST", "0.0.0.0"),
            api_port=int(os.getenv("API_PORT", "8000")),
            memory_backend=os.getenv("MEMORY_BACKEND", "sqlite"),
            memory_path=os.getenv("MEMORY_PATH", "./data/memory.sqlite3"),
            memory_token_budget=int(os.getenv("MEMORY_TOKEN_BUDGET", "2048")),
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            groq_api_key=os.getenv("GROQ_API_KEY", ""),
            gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
            deepseek_api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            zai_api_key=os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", "")),
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            fallback_providers=os.getenv("FALLBACK_PROVIDERS", "groq,gemini,deepseek,zai,openrouter,ollama"),
            cron_secret=os.getenv("CRON_SECRET", ""),
        )
