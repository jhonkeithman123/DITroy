import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ditroy.config import DitroyConfig
from ditroy.engine import DitroyEngine
from ditroy.identity import DEFAULT_AI_IDENTITY, build_chat_prompt
from services.memory import LocalMemoryStore
from services.model_client import StubModelClient


def test_ditroy_engine_standalone_chat(tmp_path):
    config = DitroyConfig(
        model_provider="stub",
        memory_backend="sqlite",
        memory_path=tmp_path / "engine_test.sqlite3",
    )
    engine = DitroyEngine(config=config)

    result = engine.chat("Hello there!", conversation_id="conv_1")
    assert "Echo:" in result.reply
    assert result.conversation_id == "conv_1"

    # Verify messages saved
    history = engine.get_messages("conv_1")
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello there!"
    assert history[1]["role"] == "assistant"


def test_ditroy_engine_fact_capture_and_inheritance(tmp_path):
    config = DitroyConfig(
        model_provider="stub",
        memory_backend="sqlite",
        memory_path=tmp_path / "facts_test.sqlite3",
    )
    engine = DitroyEngine(config=config)

    # 1. Chat with a quoted fact
    engine.chat('Please remember the secret code "Omega-42".', conversation_id="session_a")
    assert engine.fact_count("session_a") == 1

    # 2. Spawn session_b inheriting facts
    new_conv = engine.create_conversation(source_conversation_id="session_a")
    assert new_conv.inherited_facts == 1
    assert engine.fact_count(new_conv.conversation_id) == 1

    # 3. Check context of new session contains the fact
    ctx = engine.context(new_conv.conversation_id)
    assert "Omega-42" in ctx


def test_ditroy_engine_custom_identity(tmp_path):
    captured_prompts = []

    class MockModelClient(StubModelClient):
        def generate(self, prompt, **kwargs):
            captured_prompts.append(prompt)
            return "Custom reply"

    custom_id = "You are RoboAdvisor, an expert financial AI."
    engine = DitroyEngine(
        model_client=MockModelClient(),
        memory_store=LocalMemoryStore(tmp_path / "custom_id.json"),
        identity=custom_id,
    )

    res = engine.chat("Help me plan a budget.", conversation_id="fin_1")
    assert res.reply == "Custom reply"
    assert len(captured_prompts) == 1
    assert "You are RoboAdvisor" in captured_prompts[0]
