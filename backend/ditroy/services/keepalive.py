from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any


def format_duration(seconds: float) -> str:
    """Format duration in seconds into a friendly human-readable string."""
    total_seconds = int(seconds)
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, secs = divmod(remainder, 60)

    parts: list[str] = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0:
        parts.append(f"{minutes}m")
    parts.append(f"{secs}s")

    return " ".join(parts)


class KeepAliveTracker:
    """Thread-safe tracker for server uptime and cron keepalive statistics."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._start_time = datetime.now(timezone.utc)
        self._total_pings = 0
        self._last_ping_time: datetime | None = None

    @property
    def start_time(self) -> datetime:
        return self._start_time

    @property
    def total_pings(self) -> int:
        with self._lock:
            return self._total_pings

    @property
    def last_ping_time(self) -> datetime | None:
        with self._lock:
            return self._last_ping_time

    def record_ping(self) -> dict[str, Any]:
        """Record an incoming keepalive ping and return updated metrics."""
        now = datetime.now(timezone.utc)
        with self._lock:
            previous_ping = self._last_ping_time
            self._total_pings += 1
            self._last_ping_time = now
            uptime_sec = (now - self._start_time).total_seconds()
            pings_count = self._total_pings

        return {
            "uptime_seconds": round(uptime_sec, 2),
            "uptime_human": format_duration(uptime_sec),
            "pings_received": pings_count,
            "timestamp": now.isoformat(),
            "last_ping_at": previous_ping.isoformat() if previous_ping else None,
        }

    def get_status(self) -> dict[str, Any]:
        """Get current keepalive status without incrementing ping count."""
        now = datetime.now(timezone.utc)
        with self._lock:
            uptime_sec = (now - self._start_time).total_seconds()
            return {
                "uptime_seconds": round(uptime_sec, 2),
                "uptime_human": format_duration(uptime_sec),
                "pings_received": self._total_pings,
                "timestamp": now.isoformat(),
                "last_ping_at": self._last_ping_time.isoformat() if self._last_ping_time else None,
            }

    def reset(self) -> None:
        """Reset stats (primarily for testing)."""
        with self._lock:
            self._start_time = datetime.now(timezone.utc)
            self._total_pings = 0
            self._last_ping_time = None
