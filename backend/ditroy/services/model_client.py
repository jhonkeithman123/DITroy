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
    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7) -> str:
        raise NotImplementedError

    @abstractmethod
    def stream(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        raise NotImplementedError

    @abstractmethod
    def health_check(self) -> dict:
        raise NotImplementedError


class StubModelClient(ModelClient):
    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7) -> str:
        return f"Echo: {prompt}"

    def stream(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        words = f"Echo: {prompt}".split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    def health_check(self) -> dict:
        return {"status": "ok", "provider": "stub"}


class LocalOllamaClient(ModelClient):
    def __init__(self, base_url: str = "http://127.0.0.1:11434", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def generate(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7) -> str:
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

    def stream(self, prompt: str, max_tokens: int = 256, temperature: float = 0.7):
        try:
            with httpx.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                },
                timeout=60.0,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        chunk = data.get("response", "")
                        if chunk:
                            yield chunk
                    except json.JSONDecodeError:
                        continue
        except Exception as exc:
            logger.warning("Local Ollama stream error: %s", exc)
            yield f" [Stream error: {exc}]"

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
    """Normalize model names to official Groq model identifiers."""
    cleaned = (model or "").strip()
    if not cleaned:
        return "openai/gpt-oss-120b"
    if "/" in cleaned:
        return cleaned

    mapping = {
        "gpt-oss-120b": "openai/gpt-oss-120b",
        "gpt-oss-20b": "openai/gpt-oss-20b",
        "120b": "openai/gpt-oss-120b",
        "20b": "openai/gpt-oss-20b",
        "qwen3.8-27b": "qwen/qwen3.8-27b",
        "qwen3.8": "qwen/qwen3.8-27b",
        "qwen": "qwen/qwen3.8-27b",
        "compound-mini": "groq/compound-mini",
        "compound": "groq/compound-mini",
        "llama3.3": "openai/gpt-oss-120b",
        "llama3.2": "openai/gpt-oss-120b",
        "llama3.1": "openai/gpt-oss-20b",
        "llama": "openai/gpt-oss-120b",
    }
    return mapping.get(cleaned.lower(), cleaned)


class GroqModelClient(ModelClient):
    """Ultra-fast cloud LLM inference using Groq's OpenAI-compatible API."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "openai/gpt-oss-120b",
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

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        if not self.api_key:
            self.api_key = os.getenv("GROQ_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("Groq API key not configured.")
            yield f"Groq API key missing. Prompt received: {prompt}"
            return

        try:
            with httpx.stream(
                "POST",
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
                    "stream": True,
                },
                timeout=60.0,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break
                        try:
                            payload = json.loads(raw)
                            choices = payload.get("choices", [])
                            if choices and "delta" in choices[0]:
                                content = choices[0]["delta"].get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.warning("Groq stream error: %s", exc)
            yield f" [Stream error: {exc}]"

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

