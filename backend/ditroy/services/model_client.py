from __future__ import annotations

import json
import logging
import os
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


def _normalize_groq_model(model: str) -> str:
    """Normalize local model names (e.g. 'llama3.2', 'llama3.1') to official Groq model identifiers."""
    cleaned = (model or "").strip().lower()
    mapping = {
        "llama3.3": "llama-3.3-70b-versatile",
        "llama3.3-70b": "llama-3.3-70b-versatile",
        "llama-3.3": "llama-3.3-70b-versatile",
        "llama3.2": "llama-3.3-70b-versatile",
        "llama-3.2": "llama-3.3-70b-versatile",
        "llama3.1": "llama-3.1-8b-instant",
        "llama-3.1": "llama-3.1-8b-instant",
        "llama3": "llama-3.1-8b-instant",
        "mixtral": "mixtral-8x7b-32768",
        "gemma2": "gemma2-9b-it",
    }
    return mapping.get(cleaned, model if model and "-" in model else "llama-3.3-70b-versatile")


class GroqModelClient(ModelClient):
    """Ultra-fast cloud LLM inference using Groq's OpenAI-compatible API."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "llama-3.3-70b-versatile",
        base_url: str = "https://api.groq.com/openai/v1",
    ):
        self.api_key = (api_key or os.getenv("GROQ_API_KEY", "")).strip()
        self.model = _normalize_groq_model(model)
        self.base_url = (base_url or "https://api.groq.com/openai/v1").rstrip("/")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        if not self.api_key:
            self.api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("Groq API key not configured.")
            return f"Groq API key missing. Prompt received: {prompt}"

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            payload = response.json()
            choices = payload.get("choices", [])
            if choices and "message" in choices[0]:
                content = choices[0]["message"].get("content", "").strip()
                if content:
                    return content
            logger.warning("Groq returned empty response for prompt: %s", prompt)
            return f"Groq returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("Groq model unavailable. I received: %s | error=%s", prompt, exc)
            return f"Groq unavailable: {exc}"

    def health_check(self) -> dict:
        if not self.api_key:
            self.api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not self.api_key:
            return {
                "status": "degraded",
                "provider": "groq",
                "model": self.model,
                "message": "GROQ_API_KEY is not configured.",
            }
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if response.status_code == 200:
                return {"status": "ok", "provider": "groq", "model": self.model}
            return {
                "status": "degraded",
                "provider": "groq",
                "model": self.model,
                "message": f"Groq API returned HTTP {response.status_code}",
            }
        except httpx.HTTPError:
            return {
                "status": "degraded",
                "provider": "groq",
                "model": self.model,
                "message": "Unable to reach Groq API endpoint.",
            }


class CustomOllamaClient(LocalOllamaClient):
    """Ollama client for a custom model built from a Modelfile."""


def create_model_client(
    *,
    provider: str,
    model: str,
    base_url: str = "http://127.0.0.1:11434",
    groq_api_key: str = "",
) -> ModelClient:
    provider_name = (provider or "ollama").strip().lower()
    if provider_name == "ollama":
        return CustomOllamaClient(base_url=base_url, model=model)
    if provider_name == "groq":
        return GroqModelClient(api_key=groq_api_key or os.getenv("GROQ_API_KEY", ""), model=model)
    if provider_name == "stub":
        return StubModelClient()
    raise ValueError(f"Unsupported MODEL_PROVIDER '{provider_name}'. Use 'groq', 'ollama', or 'stub'.")

