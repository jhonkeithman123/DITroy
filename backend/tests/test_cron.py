from __future__ import annotations

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app, engine, keepalive_tracker
from ditroy.services.keepalive import KeepAliveTracker, format_duration

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_tracker_and_config():
    keepalive_tracker.reset()
    original_secret = getattr(engine.config, "cron_secret", "")
    yield
    engine.config.cron_secret = original_secret
    keepalive_tracker.reset()


def test_format_duration_formats_seconds_minutes_hours_days():
    assert format_duration(45) == "45s"
    assert format_duration(125) == "2m 5s"
    assert format_duration(3665) == "1h 1m 5s"
    assert format_duration(90065) == "1d 1h 1m 5s"


def test_keepalive_tracker_records_pings_and_status():
    tracker = KeepAliveTracker()
    assert tracker.total_pings == 0
    assert tracker.last_ping_time is None

    ping1 = tracker.record_ping()
    assert ping1["pings_received"] == 1
    assert ping1["last_ping_at"] is None
    assert ping1["uptime_seconds"] >= 0

    ping2 = tracker.record_ping()
    assert ping2["pings_received"] == 2
    assert ping2["last_ping_at"] is not None

    status = tracker.get_status()
    assert status["pings_received"] == 2

    tracker.reset()
    assert tracker.total_pings == 0


def test_cron_keepalive_endpoint_open_by_default():
    engine.config.cron_secret = ""

    response = client.get("/api/cron/keepalive")
    assert response.status_code == 200
    payload = response.json()

    assert payload["status"] == "ok"
    assert "Keepalive signal received" in payload["message"]
    assert payload["service"] == "ditroy-ai-backend"
    assert payload["pings_received"] == 1
    assert payload["uptime_seconds"] >= 0
    assert "timestamp" in payload


def test_cron_keepalive_aliases_and_methods():
    engine.config.cron_secret = ""

    # POST method
    resp_post = client.post("/api/cron/keepalive")
    assert resp_post.status_code == 200

    # /cron alias
    resp_cron = client.get("/cron")
    assert resp_cron.status_code == 200

    # /ping alias
    resp_ping = client.get("/ping")
    assert resp_ping.status_code == 200

    assert resp_ping.json()["pings_received"] >= 3


def test_cron_keepalive_unauthorized_when_secret_configured():
    engine.config.cron_secret = "super-secret-cron-key-123"

    # Request without secret
    resp = client.get("/api/cron/keepalive")
    assert resp.status_code == 401
    assert "Unauthorized" in resp.json()["detail"]

    # Request with wrong secret
    resp_bad = client.get("/api/cron/keepalive", headers={"Authorization": "Bearer wrong-key"})
    assert resp_bad.status_code == 401


def test_cron_keepalive_authorized_with_bearer_token():
    engine.config.cron_secret = "super-secret-cron-key-123"

    resp = client.get("/api/cron/keepalive", headers={"Authorization": "Bearer super-secret-cron-key-123"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_cron_keepalive_authorized_with_x_cron_key_header():
    engine.config.cron_secret = "super-secret-cron-key-123"

    resp = client.get("/api/cron/keepalive", headers={"x-cron-key": "super-secret-cron-key-123"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_cron_keepalive_authorized_with_query_params():
    engine.config.cron_secret = "super-secret-cron-key-123"

    # with ?key=
    resp_key = client.get("/api/cron/keepalive?key=super-secret-cron-key-123")
    assert resp_key.status_code == 200

    # with ?token=
    resp_token = client.post("/api/cron/keepalive?token=super-secret-cron-key-123")
    assert resp_token.status_code == 200
