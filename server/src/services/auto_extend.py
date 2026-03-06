"""
Sandbox TTL auto-extension service.

Automatically extends sandbox lifetime based on recent API activity,
preventing active sandboxes from expiring unexpectedly.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from src.services.event_bus import EventBus, EventType, SandboxEvent, get_event_bus

logger = logging.getLogger(__name__)


class AutoExtendConfig:
    def __init__(
        self,
        enabled: bool = True,
        activity_window_seconds: int = 300,
        extension_seconds: int = 600,
        max_extensions: int = 48,
        min_remaining_seconds: int = 120,
    ) -> None:
        self.enabled = enabled
        self.activity_window_seconds = activity_window_seconds
        self.extension_seconds = extension_seconds
        self.max_extensions = max_extensions
        self.min_remaining_seconds = min_remaining_seconds


class AutoExtendManager:
    """Tracks sandbox activity and auto-extends TTL when needed."""

    def __init__(self, config: Optional[AutoExtendConfig] = None) -> None:
        self._config = config or AutoExtendConfig()
        self._activity: Dict[str, float] = {}
        self._extension_counts: Dict[str, int] = {}
        self._lock = threading.Lock()

    def record_activity(self, sandbox_id: str) -> None:
        if not self._config.enabled:
            return
        with self._lock:
            self._activity[sandbox_id] = time.monotonic()

    def should_extend(self, sandbox_id: str, expires_at: datetime) -> bool:
        if not self._config.enabled:
            return False
        with self._lock:
            last_active = self._activity.get(sandbox_id)
            if last_active is None:
                return False
            elapsed = time.monotonic() - last_active
            if elapsed > self._config.activity_window_seconds:
                return False
            ext_count = self._extension_counts.get(sandbox_id, 0)
            if ext_count >= self._config.max_extensions:
                return False

        now = datetime.now(timezone.utc)
        remaining = (expires_at - now).total_seconds()
        return remaining < self._config.min_remaining_seconds

    def mark_extended(self, sandbox_id: str) -> int:
        with self._lock:
            count = self._extension_counts.get(sandbox_id, 0) + 1
            self._extension_counts[sandbox_id] = count
            return count

    def get_new_expiration(self, current_expires: datetime) -> datetime:
        return current_expires + timedelta(seconds=self._config.extension_seconds)

    def cleanup(self, sandbox_id: str) -> None:
        with self._lock:
            self._activity.pop(sandbox_id, None)
            self._extension_counts.pop(sandbox_id, None)

    def get_stats(self, sandbox_id: str) -> Dict[str, Any]:
        with self._lock:
            return {
                "sandbox_id": sandbox_id,
                "extension_count": self._extension_counts.get(sandbox_id, 0),
                "max_extensions": self._config.max_extensions,
                "last_activity": self._activity.get(sandbox_id),
                "enabled": self._config.enabled,
            }


_global_auto_extend: Optional[AutoExtendManager] = None


def get_auto_extend_manager() -> AutoExtendManager:
    global _global_auto_extend
    if _global_auto_extend is None:
        _global_auto_extend = AutoExtendManager()
    return _global_auto_extend


def reset_auto_extend_manager() -> None:
    global _global_auto_extend
    _global_auto_extend = None


def setup_auto_extend_listener(bus: Optional[EventBus] = None) -> None:
    event_bus = bus or get_event_bus()
    manager = get_auto_extend_manager()

    activity_events = {
        EventType.API_REQUEST,
        EventType.SANDBOX_EXPIRATION_RENEWED,
    }

    def _on_event(event: SandboxEvent) -> None:
        if event.event_type in activity_events and event.sandbox_id:
            manager.record_activity(event.sandbox_id)
        elif event.event_type == EventType.SANDBOX_DELETED:
            manager.cleanup(event.sandbox_id)

    event_bus.subscribe(None, _on_event)
