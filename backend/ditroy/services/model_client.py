from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ModelClient(ABC):
    @abstractmethod
    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        raise NotImplementedError

    @abstractmethod
    def health_check(self) -> dict:
        raise NotImplementedError


class StubModelClient(ModelClient):
    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        return f"Echo: {prompt}"

    def health_check(self) -> dict:
        return {"status": "ok", "provider": "stub"}


class LocalOllamaClient(ModelClient):
    def __init__(self, base_url: str = "http://127.0.0.1:11434", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        try:
            response = httpx.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            payload = response.json()
            result = payload.get("response", "").strip()
            if result:
                return result
            logger.warning("Local model returned empty response for prompt: %s", prompt)
            return f"Local model returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("Local model unavailable. I received: %s | error=%s", prompt, exc)
            return f"Local model unavailable. I received: {prompt}"

    def health_check(self) -> dict:
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", [])
            names = [model.get("name", "") for model in models if isinstance(model, dict)]
            if self.model in names:
                return {"status": "ok", "provider": "ollama", "model": self.model}
            return {"status": "degraded", "provider": "ollama", "model": self.model, "available_models": names}
        except httpx.HTTPError:
            return {"status": "degraded", "provider": "ollama", "model": self.model, "message": "Local Ollama server is not running."}


class CustomOllamaClient(LocalOllamaClient):
    """Ollama client for a custom model built from a Modelfile."""


def create_model_client(*, provider: str, model: str, base_url: str) -> ModelClient:
    provider_name = (provider or "ollama").strip().lower()
    if provider_name == "ollama":
        return CustomOllamaClient(base_url=base_url, model=model)
    if provider_name == "stub":
        return StubModelClient()
    raise ValueError(f"Unsupported MODEL_PROVIDER '{provider_name}'. Use 'ollama' or 'stub'.")
