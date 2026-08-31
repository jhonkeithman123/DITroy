from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient
from ditroy.engine import DitroyEngine
from ditroy.services.model_client import StubModelClient, GroqModelClient
from ditroy.services.memory import LocalMemoryStore
from app.main import app, engine, _sync_engine


class MockStreamResponse:
    def __init__(self, lines: list[str], status_code: int = 200):
        self._lines = lines
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError("Error", request=None, response=None)

    def iter_lines(self):
        for line in self._lines:
            yield line

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def test_stub_model_client_stream():
    client = StubModelClient()
    tokens = list(client.stream("hello world"))
    assert "".join(tokens) == "Echo: hello world"


def test_groq_model_client_stream(monkeypatch):
    sse_events = [
        "",
        'data: {"choices": [{"delta": {"content": "Hello"}}]}',
        'data: {"choices": [{"delta": {"content": " from"}}]}',
        'data: {"choices": [{"delta": {"content": " Groq!"}}]}',
        "data: [DONE]",
    ]

    def mock_stream(method, url, headers=None, json=None, timeout=None):
        return MockStreamResponse(sse_events)

    monkeypatch.setattr("ditroy.services.model_client.httpx.stream", mock_stream)

    client = GroqModelClient(api_key="gsk_test123")
    tokens = list(client.stream("Say hello"))
    assert "".join(tokens) == "Hello from Groq!"


def test_ditroy_engine_chat_stream():
    from uuid import uuid4
    conv_id = f"stream_conv_{uuid4()}"
    memory = LocalMemoryStore()
    model = StubModelClient()
    test_engine = DitroyEngine(model_client=model, memory_store=memory)

    tokens = list(test_engine.chat_stream("How are you?", conversation_id=conv_id))
    assert len(tokens) > 0
    full_text = "".join(tokens)
    assert "Echo:" in full_text

    # Verify that user and assistant turns were stored in memory
    messages = test_engine.get_messages(conv_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "How are you?"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == full_text


def test_chat_stream_api_endpoint(monkeypatch):
    monkeypatch.setattr("app.main.model_client", StubModelClient())
    monkeypatch.setattr("app.main.memory_store", LocalMemoryStore())
    _sync_engine()

    client = TestClient(app)
    response = client.post(
        "/chat/stream",
        json={"message": "Ping", "conversation_id": "api_stream_conv"},
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    body = response.text
    assert "data: " in body
    assert "[DONE]" in body

    # Parse tokens from SSE
    tokens = []
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("data: ") and not line.endswith("[DONE]"):
            data = json.loads(line[6:])
            if "token" in data:
                tokens.append(data["token"])

    full_reply = "".join(tokens)
    assert "User: Ping" in full_reply
