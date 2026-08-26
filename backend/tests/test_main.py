from fastapi.testclient import TestClient
from uuid import uuid4
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app
from services.model_client import LocalOllamaClient
from services.memory import LocalMemoryStore, SQLiteMemoryStore, create_memory_store, estimate_tokens

client = TestClient(app)


def test_memory_compresses_old_messages_to_token_budget(tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.json", token_budget=20)
    store.add("conversation", "user", "This is a very long message " * 10)
    store.add("conversation", "assistant", "A useful answer " * 10)

    context = store.context("conversation")
    assert estimate_tokens(context) <= 20
    assert "[Earlier conversation compressed]" in context


def test_memory_persists_between_store_instances(tmp_path):
    path = tmp_path / "memory.json"
    LocalMemoryStore(path).add("conversation", "user", "remember this")

    context = LocalMemoryStore(path).context("conversation")
    assert "remember this" in context


def test_memory_factory_uses_sqlite_backend_by_default(tmp_path):
    store = create_memory_store(backend="sqlite", path=tmp_path / "factory.sqlite3", token_budget=64)
    assert isinstance(store, SQLiteMemoryStore)


def test_memory_separates_facts_from_recent_turns(tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.json", token_budget=80)
    store.remember("conversation", "The user's favorite word is Rudeous")
    store.add("conversation", "user", "A short recent message")

    context = store.context("conversation")
    assert "Saved facts:" in context
    assert "Rudeous" in context
    assert "Recent conversation:" in context


def test_memory_extracts_quoted_remember_fact(tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.json")
    facts = store.capture_facts("conversation", 'Please remember the word "Rudeous".')

    assert facts == ['Remembered word: "Rudeous"']
    assert '"Rudeous"' in store.context("conversation")


def test_memory_can_inherit_facts_without_copying_recent_turns(tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.json")
    store.remember("old-chat", "Remembered word: Rudeous")
    store.add("old-chat", "user", "An old private message")

    store.inherit_facts("old-chat", "new-chat")
    context = store.context("new-chat")

    assert "Rudeous" in context
    assert "old private message" not in context


def test_new_conversation_inherits_facts():
    source = f"test-source-{uuid4()}"
    response = client.post("/conversations", json={"source_conversation_id": source})
    assert response.status_code == 200
    payload = response.json()
    assert payload["conversation_id"]
    assert payload["conversation_id"] != source


def test_chat_prompt_defines_ditroy_identity(monkeypatch, tmp_path):
    captured = {}

    def fake_generate(prompt):
        captured["prompt"] = prompt
        return "I am DITroy, the personal AI assistant serving DITrix."

    monkeypatch.setattr("app.main.model_client.generate", fake_generate)
    monkeypatch.setattr("app.main.memory_store", LocalMemoryStore(tmp_path / "memory.json"))

    response = client.post("/chat", json={"message": "Who are you?", "conversation_id": "identity-test"})

    assert response.status_code == 200
    assert "Your name is DITroy, never DITrix" in captured["prompt"]
    assert "serving DITrix" in captured["prompt"]


def test_memory_lists_recent_conversations(tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.json")
    store.add("first-chat", "user", "Discuss the project roadmap")
    store.add("second-chat", "user", "Set up local model")

    conversations = store.list_conversations()

    assert conversations[0]["conversation_id"] == "second-chat"
    assert conversations[0]["title"] == "Set up local model"


def test_conversation_history_endpoint_returns_messages(monkeypatch, tmp_path):
    store = LocalMemoryStore(tmp_path / "memory.sqlite3")
    store.add("history-chat", "user", "Hello there")
    store.add("history-chat", "assistant", "Hi, how can I help?")
    monkeypatch.setattr("app.main.memory_store", store)

    response = client.get("/conversations/history-chat/messages")

    assert response.status_code == 200
    payload = response.json()
    assert payload["conversation_id"] == "history-chat"
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["role"] == "user"
    assert payload["messages"][1]["role"] == "assistant"


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
