from __future__ import annotations

import pytest
from ditroy.services.model_client import GroqModelClient, create_model_client


class DummyResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError("Error", request=None, response=None)

    def json(self):
        return self._payload


def test_groq_client_factory():
    client = create_model_client(
        provider="groq",
        model="llama-3.3-70b-versatile",
        groq_api_key="gsk_test123",
    )
    assert isinstance(client, GroqModelClient)
    assert client.model == "llama-3.3-70b-versatile"
    assert client.api_key == "gsk_test123"


def test_groq_client_generate_success(monkeypatch):
    captured_requests = []

    def mock_post(url, headers=None, json=None, timeout=None):
        captured_requests.append({"url": url, "headers": headers, "json": json})
        return DummyResponse(
            status_code=200,
            payload={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Hello! I am DITroy running on Groq LPU speed.",
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr("ditroy.services.model_client.httpx.post", mock_post)

    client = GroqModelClient(api_key="gsk_test123", model="llama-3.3-70b-versatile")
    reply = client.generate("Hello there!")

    assert "Groq LPU speed" in reply
    assert len(captured_requests) == 1
    assert "Bearer gsk_test123" == captured_requests[0]["headers"]["Authorization"]
    assert captured_requests[0]["json"]["model"] == "llama-3.3-70b-versatile"


def test_groq_client_missing_key(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    client = GroqModelClient(api_key="")
    reply = client.generate("test prompt")
    assert "Groq API key missing" in reply

    health = client.health_check()
    assert health["status"] == "degraded"
    assert "GROQ_API_KEY is not configured" in health["message"]


def test_groq_client_health_check_success(monkeypatch):
    monkeypatch.setattr(
        "ditroy.services.model_client.httpx.get",
        lambda url, headers=None, timeout=None: DummyResponse(status_code=200, payload={"data": []}),
    )

    client = GroqModelClient(api_key="gsk_test123")
    health = client.health_check()
    assert health["status"] == "ok"
    assert health["provider"] == "groq"
