from fastapi.testclient import TestClient
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app
from services.model_client import LocalOllamaClient

client = TestClient(app)


def test_generate_falls_back_when_model_returns_no_text(monkeypatch):
    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {}

    monkeypatch.setattr("services.model_client.httpx.post", lambda *args, **kwargs: DummyResponse())

    model = LocalOllamaClient(base_url="http://127.0.0.1:11434")
    response = model.generate("hello")
    assert "hello" in response


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["mode"] == "local-model"
    assert payload["model_status"] in {"ok", "degraded"}


def test_chat_endpoint():
    response = client.post("/chat", json={"message": "hello"})
    assert response.status_code == 200
    payload = response.json()
    assert "reply" in payload
    assert payload["reply"].strip()


def test_empty_message_is_rejected():
    response = client.post("/chat", json={"message": "   "})
    assert response.status_code == 422


def test_local_ollama_client_handles_unavailable_model():
    client = LocalOllamaClient(base_url="http://127.0.0.1:65535")
    status = client.health_check()
    assert status["status"] in {"ok", "degraded"}
    assert "provider" in status
