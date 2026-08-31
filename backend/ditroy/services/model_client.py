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
    """Local Ollama client with zero rate limits, zero token costs, and 100% offline capability."""

    def __init__(self, base_url: str = "http://127.0.0.1:11434", model: str = "llama3.2"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
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

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
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
        "qwen3.6-27b": "qwen/qwen3.6-27b",
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


def _normalize_gemini_model(model: str) -> str:
    """Normalize model names to official Google Gemini identifiers with huge token budgets."""
    cleaned = (model or "").strip()
    if not cleaned:
        return "gemini-3-flash-preview"
    mapping = {
        "gemini-3-flash-preview": "gemini-3-flash-preview",
        "gemini-3-flash": "gemini-3-flash-preview",
        "gemini-3": "gemini-3-flash-preview",
        "gemini-flash": "gemini-3-flash-preview",
        "gemini-2.0-flash": "gemini-3-flash-preview",
        "gemini-2.5-flash": "gemini-3-flash-preview",
        "gemini-1.5-flash": "gemini-3-flash-preview",
        "gemini-flash-latest": "gemini-3-flash-preview",
        "flash": "gemini-3-flash-preview",
        "gemini-pro": "gemini-3.1-pro-preview",
        "gemini-1.5-pro": "gemini-3.1-pro-preview",
        "gemini-2.5-pro": "gemini-3.1-pro-preview",
        "pro": "gemini-3.1-pro-preview",
    }
    return mapping.get(cleaned.lower(), cleaned)


class GeminiModelClient(ModelClient):
    """Google Gemini model client (1M TPM, 15 RPM, 1,500 RPD free tier on Google AI Studio)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "gemini-3-flash-preview",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai",
    ):
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        self.model = _normalize_gemini_model(model)
        self.base_url = (base_url or "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        if not self.api_key:
            self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("Gemini API key not configured.")
            return f"Gemini API key missing. Prompt received: {prompt}"

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
            logger.warning("Gemini returned empty response for prompt: %s", prompt)
            return f"Gemini returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("Gemini model unavailable. I received: %s | error=%s", prompt, exc)
            return f"Gemini unavailable: {exc}"

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        if not self.api_key:
            self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("Gemini API key not configured.")
            yield f"Gemini API key missing. Prompt received: {prompt}"
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
            logger.warning("Gemini stream error: %s", exc)
            yield f" [Stream error: {exc}]"

    def health_check(self) -> dict:
        if not self.api_key:
            self.api_key = os.getenv("GEMINI_API_KEY", "").strip()

        if not self.api_key:
            return {
                "status": "degraded",
                "provider": "gemini",
                "model": self.model,
                "message": "GEMINI_API_KEY is not configured.",
            }
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if response.status_code == 200:
                return {"status": "ok", "provider": "gemini", "model": self.model}
            return {
                "status": "degraded",
                "provider": "gemini",
                "model": self.model,
                "message": f"Gemini API returned HTTP {response.status_code}",
            }
        except httpx.HTTPError:
            return {
                "status": "degraded",
                "provider": "gemini",
                "model": self.model,
                "message": "Unable to reach Gemini API endpoint.",
            }


def _normalize_deepseek_model(model: str) -> str:
    """Normalize model names to official DeepSeek model identifiers."""
    cleaned = (model or "").strip()
    if not cleaned:
        return "deepseek-chat"
    mapping = {
        "deepseek-chat": "deepseek-chat",
        "deepseek-v3": "deepseek-chat",
        "v3": "deepseek-chat",
        "chat": "deepseek-chat",
        "deepseek-reasoner": "deepseek-reasoner",
        "deepseek-r1": "deepseek-reasoner",
        "r1": "deepseek-reasoner",
        "reasoner": "deepseek-reasoner",
    }
    return mapping.get(cleaned.lower(), cleaned)


class DeepSeekModelClient(ModelClient):
    """DeepSeek API client (deepseek-chat V3 and deepseek-reasoner R1)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "deepseek-chat",
        base_url: str = "https://api.deepseek.com",
    ):
        self.api_key = (api_key or os.getenv("DEEPSEEK_API_KEY", "")).strip()
        self.model = _normalize_deepseek_model(model)
        self.base_url = (base_url or "https://api.deepseek.com").rstrip("/")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        if not self.api_key:
            self.api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("DeepSeek API key not configured.")
            return f"DeepSeek API key missing. Prompt received: {prompt}"

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
            logger.warning("DeepSeek returned empty response for prompt: %s", prompt)
            return f"DeepSeek returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("DeepSeek model unavailable. I received: %s | error=%s", prompt, exc)
            return f"DeepSeek unavailable: {exc}"

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        if not self.api_key:
            self.api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("DeepSeek API key not configured.")
            yield f"DeepSeek API key missing. Prompt received: {prompt}"
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
                                delta = choices[0]["delta"]
                                content = delta.get("content") or delta.get("reasoning_content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.warning("DeepSeek stream error: %s", exc)
            yield f" [Stream error: {exc}]"

    def health_check(self) -> dict:
        if not self.api_key:
            self.api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

        if not self.api_key:
            return {
                "status": "degraded",
                "provider": "deepseek",
                "model": self.model,
                "message": "DEEPSEEK_API_KEY is not configured.",
            }
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if response.status_code == 200:
                return {"status": "ok", "provider": "deepseek", "model": self.model}
            return {
                "status": "degraded",
                "provider": "deepseek",
                "model": self.model,
                "message": f"DeepSeek API returned HTTP {response.status_code}",
            }
        except httpx.HTTPError:
            return {
                "status": "degraded",
                "provider": "deepseek",
                "model": self.model,
                "message": "Unable to reach DeepSeek API endpoint.",
            }


def _normalize_zai_model(model: str) -> str:
    """Normalize model names to official Z.AI / Zhipu GLM identifiers."""
    cleaned = (model or "").strip()
    if not cleaned:
        return "glm-5.3-flash"
    mapping = {
        "glm4-flash": "glm-4-flash",
        "glm-flash": "glm-5.3-flash",
        "flash": "glm-5.3-flash",
    }
    return mapping.get(cleaned.lower(), cleaned)


class ZAIModelClient(ModelClient):
    """Z.AI / Zhipu GLM model client."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "glm-5.3-flash",
        base_url: str = "https://open.bigmodel.cn/api/paas/v4",
    ):
        self.api_key = (api_key or os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", ""))).strip()
        self.model = _normalize_zai_model(model)
        self.base_url = (base_url or "https://open.bigmodel.cn/api/paas/v4").rstrip("/")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        if not self.api_key:
            self.api_key = os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", "")).strip()

        if not self.api_key:
            logger.warning("Z.AI / Zhipu API key not configured.")
            return f"Z.AI API key missing. Prompt received: {prompt}"

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
            logger.warning("Z.AI returned empty response for prompt: %s", prompt)
            return f"Z.AI returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            logger.warning("Z.AI model unavailable. I received: %s | error=%s", prompt, exc)
            return f"Z.AI unavailable: {exc}"

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        if not self.api_key:
            self.api_key = os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", "")).strip()

        if not self.api_key:
            logger.warning("Z.AI API key not configured.")
            yield f"Z.AI API key missing. Prompt received: {prompt}"
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
            logger.warning("Z.AI stream error: %s", exc)
            yield f" [Stream error: {exc}]"

    def health_check(self) -> dict:
        if not self.api_key:
            self.api_key = os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", "")).strip()

        if not self.api_key:
            return {
                "status": "degraded",
                "provider": "zai",
                "model": self.model,
                "message": "ZAI_API_KEY is not configured.",
            }
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if response.status_code == 200:
                return {"status": "ok", "provider": "zai", "model": self.model}
            return {
                "status": "degraded",
                "provider": "zai",
                "model": self.model,
                "message": f"Z.AI API returned HTTP {response.status_code}",
            }
        except httpx.HTTPError:
            return {
                "status": "degraded",
                "provider": "zai",
                "model": self.model,
                "message": "Unable to reach Z.AI API endpoint.",
            }


def _normalize_openrouter_model(model: str) -> str:
    """Normalize model names for OpenRouter free models (:free suffix)."""
    cleaned = (model or "").strip()
    if not cleaned:
        return "z-ai/glm-5.2:free"
    mapping = {
        "glm": "z-ai/glm-5.2:free",
        "zai": "z-ai/glm-5.2:free",
        "nemotron": "nvidia/nemotron-3.5-lightning:free",
        "llama": "meta-llama/llama-3.3-70b-instruct",
        "gemini": "google/gemini-2.0-flash-exp:free",
        "deepseek-r1": "deepseek/deepseek-r1:free",
        "deepseek": "deepseek/deepseek-chat:free",
    }
    return mapping.get(cleaned.lower(), cleaned)


class OpenRouterModelClient(ModelClient):
    """OpenRouter client accessing free tier models (e.g. z-ai/glm-5.2:free, deepseek-r1:free)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "z-ai/glm-5.2:free",
        base_url: str = "https://openrouter.ai/api/v1",
    ):
        self.api_key = (api_key or os.getenv("OPENROUTER_API_KEY", "")).strip()
        self.model = _normalize_openrouter_model(model)
        self.base_url = (base_url or "https://openrouter.ai/api/v1").rstrip("/")

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        if not self.api_key:
            self.api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        if not self.api_key:
            logger.warning("OpenRouter API key not configured.")
            return f"OpenRouter API key missing. Prompt received: {prompt}"

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
            return f"OpenRouter returned no text for: {prompt}"
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            return f"OpenRouter unavailable: {exc}"

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        if not self.api_key:
            self.api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

        if not self.api_key:
            yield f"OpenRouter API key missing. Prompt received: {prompt}"
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
            yield f" [Stream error: {exc}]"

    def health_check(self) -> dict:
        if not self.api_key:
            self.api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        if not self.api_key:
            return {
                "status": "degraded",
                "provider": "openrouter",
                "model": self.model,
                "message": "OPENROUTER_API_KEY is not configured.",
            }
        try:
            response = httpx.get(
                f"{self.base_url}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5.0,
            )
            if response.status_code == 200:
                return {"status": "ok", "provider": "openrouter", "model": self.model}
            return {
                "status": "degraded",
                "provider": "openrouter",
                "model": self.model,
                "message": f"OpenRouter API returned HTTP {response.status_code}",
            }
        except httpx.HTTPError:
            return {
                "status": "degraded",
                "provider": "openrouter",
                "model": self.model,
                "message": "Unable to reach OpenRouter API endpoint.",
            }


class CascadeModelClient(ModelClient):
    """Cascading multi-provider failover pool.

    Tries providers in sequential priority order (e.g. Groq -> Gemini -> DeepSeek -> Z.AI -> OpenRouter -> Ollama).
    If a provider encounters rate limits (429), timeouts, missing keys, or server degradation,
    it automatically falls back to the next available provider.
    """

    def __init__(self, clients: list[tuple[str, ModelClient]]):
        self.clients = clients

    def _is_failed_response(self, text: str) -> bool:
        if not text or not text.strip():
            return True
        lower = text.lower()
        fail_markers = [
            "missing",
            "unavailable",
            "rate limit",
            "too many requests",
            "429",
            "quota exceeded",
            "resource exhausted",
            "returned no text",
        ]
        return any(marker in lower for marker in fail_markers)

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7) -> str:
        last_error = ""
        for name, client in self.clients:
            try:
                res = client.generate(prompt, max_tokens=max_tokens, temperature=temperature)
                if self._is_failed_response(res):
                    logger.warning("Provider '%s' failed (%s), falling back to next provider...", name, res)
                    last_error = f"[{name}]: {res}"
                    continue
                return res
            except Exception as exc:
                logger.warning("Provider '%s' raised exception: %s, falling back...", name, exc)
                last_error = f"[{name}]: {exc}"
                continue

        return f"All cascade providers failed. Last error: {last_error}"

    def stream(self, prompt: str, max_tokens: int = 512, temperature: float = 0.7):
        last_error = ""
        for name, client in self.clients:
            try:
                generator = client.stream(prompt, max_tokens=max_tokens, temperature=temperature)
                first_chunk = None
                try:
                    first_chunk = next(generator)
                except StopIteration:
                    logger.warning("Provider '%s' stream returned no tokens, falling back...", name)
                    last_error = f"[{name}]: empty stream"
                    continue

                if self._is_failed_response(first_chunk) or "stream error" in first_chunk.lower():
                    logger.warning("Provider '%s' stream error chunk: %s, falling back...", name, first_chunk)
                    last_error = f"[{name}]: {first_chunk}"
                    continue

                yield first_chunk
                yield from generator
                return
            except Exception as exc:
                logger.warning("Provider '%s' stream exception: %s, falling back...", name, exc)
                last_error = f"[{name}]: {exc}"
                continue

        yield f" [All cascade providers failed: {last_error}]"

    def health_check(self) -> dict:
        statuses = {}
        active_provider = None
        for name, client in self.clients:
            chk = client.health_check()
            statuses[name] = chk
            if chk.get("status") == "ok" and active_provider is None:
                active_provider = name

        return {
            "status": "ok" if active_provider else "degraded",
            "provider": "cascade",
            "active_primary": active_provider or "none",
            "providers": statuses,
        }


class CustomOllamaClient(LocalOllamaClient):
    """Ollama client for a custom model built from a Modelfile."""


def create_model_client(
    *,
    provider: str = "ollama",
    model: str | None = None,
    base_url: str = "http://127.0.0.1:11434",
    groq_api_key: str = "",
    gemini_api_key: str = "",
    deepseek_api_key: str = "",
    zai_api_key: str = "",
    openrouter_api_key: str = "",
    fallback_providers: list[str] | str | None = None,
) -> ModelClient:
    provider_name = (provider or "ollama").strip().lower()

    if provider_name == "ollama":
        return CustomOllamaClient(base_url=base_url, model=model or "llama3.2")
    if provider_name == "groq":
        return GroqModelClient(api_key=groq_api_key or os.getenv("GROQ_API_KEY", ""), model=model or "llama-3.3-70b-versatile")
    if provider_name == "gemini":
        return GeminiModelClient(api_key=gemini_api_key or os.getenv("GEMINI_API_KEY", ""), model=model or "gemini-2.0-flash")
    if provider_name == "deepseek":
        return DeepSeekModelClient(api_key=deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", ""), model=model or "deepseek-chat")
    if provider_name in ("zai", "zhipu"):
        return ZAIModelClient(api_key=zai_api_key or os.getenv("ZAI_API_KEY", os.getenv("ZHIPU_API_KEY", "")), model=model or "glm-4-flash")
    if provider_name == "openrouter":
        return OpenRouterModelClient(api_key=openrouter_api_key or os.getenv("OPENROUTER_API_KEY", ""), model=model or "meta-llama/llama-3.3-70b-instruct:free")
    if provider_name == "stub":
        return StubModelClient()

    if provider_name in ("fallback", "cascade", "auto", "hybrid"):
        if isinstance(fallback_providers, str):
            p_list = [p.strip().lower() for p in fallback_providers.split(",") if p.strip()]
        elif isinstance(fallback_providers, list):
            p_list = [p.strip().lower() for p in fallback_providers if p.strip()]
        else:
            p_list = ["groq", "gemini", "deepseek", "zai", "openrouter", "ollama"]

        clients: list[tuple[str, ModelClient]] = []
        for p in p_list:
            if p == "groq":
                clients.append(("groq", GroqModelClient(api_key=groq_api_key, model=model if provider_name == "groq" and model else "openai/gpt-oss-120b")))
            elif p == "gemini":
                clients.append(("gemini", GeminiModelClient(api_key=gemini_api_key, model=model if provider_name == "gemini" and model else "gemini-3-flash-preview")))
            elif p == "deepseek":
                clients.append(("deepseek", DeepSeekModelClient(api_key=deepseek_api_key, model=model if provider_name == "deepseek" and model else "deepseek-chat")))
            elif p in ("zai", "zhipu"):
                clients.append(("zai", ZAIModelClient(api_key=zai_api_key, model=model if provider_name in ("zai", "zhipu") and model else "glm-5.3-flash")))
            elif p == "openrouter":
                clients.append(("openrouter", OpenRouterModelClient(api_key=openrouter_api_key, model=model if provider_name == "openrouter" and model else "z-ai/glm-5.2:free")))
            elif p == "ollama":
                clients.append(("ollama", CustomOllamaClient(base_url=base_url, model=model if provider_name == "ollama" and model else "llama3.2")))
            elif p == "stub":
                clients.append(("stub", StubModelClient()))

        return CascadeModelClient(clients)

    raise ValueError(f"Unsupported MODEL_PROVIDER '{provider_name}'. Use 'groq', 'gemini', 'deepseek', 'zai', 'openrouter', 'ollama', 'fallback', or 'stub'.")
