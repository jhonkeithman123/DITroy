from __future__ import annotations

import httpx
import pytest

from ditroy.services.model_client import (
    CascadeModelClient,
    DeepSeekModelClient,
    GeminiModelClient,
    GroqModelClient,
    LocalOllamaClient,
    OpenRouterModelClient,
    StubModelClient,
    ZAIModelClient,
    create_model_client,
)


class DummyResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("API Error", request=None, response=None)

    def json(self):
        return self._payload


# ==========================================
# Gemini Client Tests
# ==========================================

def test_gemini_client_factory():
    client = create_model_client(
        provider="gemini",
        model="gemini-3-flash-preview",
        gemini_api_key="gemini_test_key_123",
    )
    assert isinstance(client, GeminiModelClient)
    assert client.model == "gemini-3-flash-preview"
    assert client.api_key == "gemini_test_key_123"


def test_gemini_client_generate_success(monkeypatch):
    captured = []

    def mock_post(url, headers=None, json=None, timeout=None):
        captured.append({"url": url, "headers": headers, "json": json})
        return DummyResponse(
            status_code=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Hello from Google Gemini Flash!",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("ditroy.services.model_client.httpx.post", mock_post)

    client = GeminiModelClient(api_key="gemini_test_key_123", model="gemini-3-flash-preview")
    reply = client.generate("Hello Gemini!")

    assert "Google Gemini Flash" in reply
    assert len(captured) == 1
    assert "Bearer gemini_test_key_123" == captured[0]["headers"]["Authorization"]
    assert captured[0]["json"]["model"] == "gemini-3-flash-preview"


def test_gemini_client_missing_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    client = GeminiModelClient(api_key="")
    reply = client.generate("test prompt")
    assert "Gemini API key missing" in reply

    health = client.health_check()
    assert health["status"] == "degraded"
    assert "GEMINI_API_KEY is not configured" in health["message"]


def test_gemini_client_stream(monkeypatch):
    class MockStreamResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_lines(self):
            yield 'data: {"choices": [{"delta": {"content": "Gemini "}}]}'
            yield 'data: {"choices": [{"delta": {"content": "stream!"}}]}'
            yield 'data: [DONE]'

    monkeypatch.setattr(
        "ditroy.services.model_client.httpx.stream",
        lambda *args, **kwargs: MockStreamResponse(),
    )

    client = GeminiModelClient(api_key="test_key")
    tokens = list(client.stream("Stream test"))
    assert "".join(tokens) == "Gemini stream!"


# ==========================================
# DeepSeek Client Tests
# ==========================================

def test_deepseek_client_factory():
    client = create_model_client(
        provider="deepseek",
        model="deepseek-chat",
        deepseek_api_key="ds_test_key",
    )
    assert isinstance(client, DeepSeekModelClient)
    assert client.model == "deepseek-chat"
    assert client.api_key == "ds_test_key"


def test_deepseek_client_generate_success(monkeypatch):
    def mock_post(url, headers=None, json=None, timeout=None):
        return DummyResponse(
            status_code=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "DeepSeek V3 response.",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("ditroy.services.model_client.httpx.post", mock_post)

    client = DeepSeekModelClient(api_key="ds_test_key")
    reply = client.generate("Hello DeepSeek")
    assert "DeepSeek V3" in reply


def test_deepseek_reasoner_stream(monkeypatch):
    class MockStreamResponse:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_lines(self):
            yield 'data: {"choices": [{"delta": {"reasoning_content": "<think>1+1=2</think>"}}]}'
            yield 'data: {"choices": [{"delta": {"content": "Answer is 2"}}]}'
            yield 'data: [DONE]'

    monkeypatch.setattr(
        "ditroy.services.model_client.httpx.stream",
        lambda *args, **kwargs: MockStreamResponse(),
    )

    client = DeepSeekModelClient(api_key="test_key", model="deepseek-reasoner")
    tokens = list(client.stream("Calculate 1+1"))
    assert "<think>1+1=2</think>" in "".join(tokens)
    assert "Answer is 2" in "".join(tokens)


# ==========================================
# Z.AI / GLM Client Tests
# ==========================================

def test_zai_client_factory():
    client = create_model_client(
        provider="zai",
        model="glm-4-flash",
        zai_api_key="zai_key_123",
    )
    assert isinstance(client, ZAIModelClient)
    assert client.model == "glm-4-flash"
    assert client.api_key == "zai_key_123"


def test_zai_client_generate_success(monkeypatch):
    def mock_post(url, headers=None, json=None, timeout=None):
        return DummyResponse(
            status_code=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "GLM-4 Flash response.",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("ditroy.services.model_client.httpx.post", mock_post)

    client = ZAIModelClient(api_key="zai_key_123")
    reply = client.generate("Hello GLM")
    assert "GLM-4 Flash" in reply


# ==========================================
# OpenRouter Free Models Tests
# ==========================================

def test_openrouter_client_factory():
    client = create_model_client(
        provider="openrouter",
        model="meta-llama/llama-3.3-70b-instruct:free",
        openrouter_api_key="or_key_123",
    )
    assert isinstance(client, OpenRouterModelClient)
    assert client.model == "meta-llama/llama-3.3-70b-instruct:free"
    assert client.api_key == "or_key_123"


def test_openrouter_client_generate_success(monkeypatch):
    def mock_post(url, headers=None, json=None, timeout=None):
        return DummyResponse(
            status_code=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Free OpenRouter reply.",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("ditroy.services.model_client.httpx.post", mock_post)

    client = OpenRouterModelClient(api_key="or_key_123")
    reply = client.generate("Hello OpenRouter")
    assert "Free OpenRouter" in reply


# ==========================================
# Cascade Failover Pool Tests
# ==========================================

def test_cascade_client_factory():
    client = create_model_client(
        provider="fallback",
        fallback_providers="groq,gemini,deepseek,zai,openrouter,ollama,stub",
        groq_api_key="g_key",
        gemini_api_key="gem_key",
    )
    assert isinstance(client, CascadeModelClient)
    assert len(client.clients) == 7


def test_cascade_client_primary_success():
    stub1 = StubModelClient()
    stub2 = StubModelClient()
    cascade = CascadeModelClient([("primary", stub1), ("backup", stub2)])

    res = cascade.generate("Test prompt")
    assert "Echo: Test prompt" in res


def test_cascade_client_failover_on_error():
    class FailingClient(StubModelClient):
        def generate(self, prompt, **kwargs):
            return "Groq unavailable: HTTP 429 Too Many Requests rate limit exceeded"

    class WorkingClient(StubModelClient):
        def generate(self, prompt, **kwargs):
            return "Gemini recovered your request successfully!"

    cascade = CascadeModelClient([
        ("groq", FailingClient()),
        ("gemini", WorkingClient()),
    ])

    res = cascade.generate("Hello world")
    assert "Gemini recovered" in res


def test_cascade_client_health_check():
    class HealthyClient(StubModelClient):
        def health_check(self):
            return {"status": "ok", "provider": "gemini"}

    class UnhealthyClient(StubModelClient):
        def health_check(self):
            return {"status": "degraded", "provider": "groq", "message": "unconfigured"}

    cascade = CascadeModelClient([
        ("groq", UnhealthyClient()),
        ("gemini", HealthyClient()),
    ])

    health = cascade.health_check()
    assert health["status"] == "ok"
    assert health["active_primary"] == "gemini"
    assert health["providers"]["groq"]["status"] == "degraded"
    assert health["providers"]["gemini"]["status"] == "ok"
