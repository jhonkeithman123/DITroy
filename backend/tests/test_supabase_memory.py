from __future__ import annotations

from typing import Any
import pytest
from datetime import datetime, timezone

from ditroy.services.memory import SupabaseMemoryStore, create_memory_store, estimate_tokens


class MockQueryBuilder:
    def __init__(self, data_store: list[dict[str, Any]], table_name: str):
        self.data_store = data_store
        self.table_name = table_name
        self._filters: list[tuple[str, Any]] = []
        self._orders: list[tuple[str, bool]] = []
        self._limit: int | None = None
        self._count_mode: str | None = None
        self._action = "select"
        self._action_payload: Any = None

    def insert(self, payload: dict[str, Any] | list[dict[str, Any]]):
        self._action = "insert"
        self._action_payload = payload if isinstance(payload, list) else [payload]
        return self

    def upsert(self, payload: dict[str, Any] | list[dict[str, Any]], on_conflict: str = "", ignore_duplicates: bool = False):
        self._action = "upsert"
        self._action_payload = payload if isinstance(payload, list) else [payload]
        return self

    def select(self, columns: str = "*", count: str | None = None):
        self._action = "select"
        self._count_mode = count
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._orders.append((column, desc))
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def execute(self):
        class MockResponse:
            def __init__(self, data: list[dict[str, Any]], count: int | None = None):
                self.data = data
                self.count = count

        if self._action == "insert":
            for item in self._action_payload:
                self.data_store.append(dict(item))
            return MockResponse(self._action_payload)

        if self._action == "upsert":
            for item in self._action_payload:
                existing = next(
                    (x for x in self.data_store if x.get("conversation_id") == item.get("conversation_id") and x.get("fact") == item.get("fact")),
                    None,
                )
                if not existing:
                    self.data_store.append(dict(item))
            return MockResponse(self._action_payload)

        # Select action
        results = list(self.data_store)
        for col, val in self._filters:
            results = [r for r in results if r.get(col) == val]

        for col, desc in self._orders:
            results.sort(key=lambda x: str(x.get(col, "")), reverse=desc)

        count = len(results) if self._count_mode == "exact" else None

        if self._limit is not None:
            results = results[: self._limit]

        return MockResponse(results, count=count)


class MockSupabaseClient:
    def __init__(self):
        self.tables: dict[str, list[dict[str, Any]]] = {
            "conversations": [],
            "messages": [],
            "memory_facts": [],
        }

    def table(self, table_name: str) -> MockQueryBuilder:
        if table_name not in self.tables:
            self.tables[table_name] = []
        return MockQueryBuilder(self.tables[table_name], table_name)


def test_supabase_memory_store_requires_credentials():
    with pytest.raises(ValueError, match="Supabase backend requires SUPABASE_URL"):
        SupabaseMemoryStore(supabase_url="", supabase_key="")


def test_create_memory_store_factory_supabase():
    mock_client = MockSupabaseClient()
    store = SupabaseMemoryStore(
        token_budget=256,
        supabase_url="https://example.supabase.co",
        supabase_key="mock-key",
        client=mock_client,
    )
    assert isinstance(store, SupabaseMemoryStore)
    assert store.token_budget == 256


def test_supabase_memory_add_and_history():
    client = MockSupabaseClient()
    store = SupabaseMemoryStore(supabase_url="https://test.co", supabase_key="test-key", client=client)

    store.add("conv_123", "user", "Hello Supabase")
    store.add("conv_123", "assistant", "Hello! I am connected to the cloud.")

    history = store.history("conv_123")
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "Hello Supabase"
    assert history[1]["role"] == "assistant"
    assert history[1]["content"] == "Hello! I am connected to the cloud."


def test_supabase_memory_facts_extraction_and_inheritance():
    client = MockSupabaseClient()
    store = SupabaseMemoryStore(supabase_url="https://test.co", supabase_key="test-key", client=client)

    facts = store.capture_facts("conv_a", 'My favorite language is "Rust" and pet is "Mochi"')
    assert len(facts) == 2
    assert store.fact_count("conv_a") == 2

    # Inherit facts to conv_b
    store.inherit_facts("conv_a", "conv_b")
    assert store.fact_count("conv_b") == 2

    context = store.context("conv_b")
    assert "Rust" in context
    assert "Mochi" in context


def test_supabase_memory_list_conversations():
    client = MockSupabaseClient()
    store = SupabaseMemoryStore(supabase_url="https://test.co", supabase_key="test-key", client=client)

    store.add("session_1", "user", "First question about architecture")
    store.add("session_2", "user", "Second question about hosting")

    convs = store.list_conversations()
    assert len(convs) == 2
    ids = [c["conversation_id"] for c in convs]
    assert store._to_uuid("session_1") in ids
    assert store._to_uuid("session_2") in ids


def test_supabase_memory_token_budget_compression():
    client = MockSupabaseClient()
    store = SupabaseMemoryStore(
        token_budget=20,
        supabase_url="https://test.co",
        supabase_key="test-key",
        client=client,
    )

    store.add("long_conv", "user", "This is an extremely long user query that exceeds the budget " * 8)
    store.add("long_conv", "assistant", "This is an extremely long response exceeding budget " * 8)

    ctx = store.context("long_conv")
    assert "[Earlier conversation compressed]" in ctx
    assert estimate_tokens(ctx) <= 20
