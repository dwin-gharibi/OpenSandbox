"""Tests for the TTL auto-extension module."""

from datetime import datetime, timedelta, timezone

import pytest
from src.services.auto_extend import (
    AutoExtendConfig,
    AutoExtendManager,
    get_auto_extend_manager,
    reset_auto_extend_manager,
    setup_auto_extend_listener,
)
from src.services.event_bus import EventBus, EventType, SandboxEvent, reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_auto_extend_manager()
    reset_event_bus()
    yield
    reset_auto_extend_manager()
    reset_event_bus()


class TestAutoExtendManager:
    def test_record_activity(self):
        mgr = AutoExtendManager()
        mgr.record_activity("sb-1")
        stats = mgr.get_stats("sb-1")
        assert stats["last_activity"] is not None

    def test_should_extend_with_recent_activity(self):
        mgr = AutoExtendManager(
            AutoExtendConfig(
                activity_window_seconds=300,
                min_remaining_seconds=120,
            )
        )
        mgr.record_activity("sb-1")
        # Sandbox expiring in 60 seconds (< 120 threshold)
        expires = datetime.now(timezone.utc) + timedelta(seconds=60)
        assert mgr.should_extend("sb-1", expires) is True

    def test_should_not_extend_far_expiration(self):
        mgr = AutoExtendManager(AutoExtendConfig(min_remaining_seconds=120))
        mgr.record_activity("sb-1")
        # Sandbox expiring in 500 seconds (> 120 threshold)
        expires = datetime.now(timezone.utc) + timedelta(seconds=500)
        assert mgr.should_extend("sb-1", expires) is False

    def test_should_not_extend_no_activity(self):
        mgr = AutoExtendManager()
        expires = datetime.now(timezone.utc) + timedelta(seconds=60)
        assert mgr.should_extend("sb-1", expires) is False

    def test_max_extensions(self):
        mgr = AutoExtendManager(
            AutoExtendConfig(
                max_extensions=2,
                min_remaining_seconds=120,
            )
        )
        mgr.record_activity("sb-1")
        mgr.mark_extended("sb-1")
        mgr.mark_extended("sb-1")
        expires = datetime.now(timezone.utc) + timedelta(seconds=60)
        assert mgr.should_extend("sb-1", expires) is False

    def test_mark_extended_returns_count(self):
        mgr = AutoExtendManager()
        assert mgr.mark_extended("sb-1") == 1
        assert mgr.mark_extended("sb-1") == 2
        assert mgr.mark_extended("sb-1") == 3

    def test_get_new_expiration(self):
        mgr = AutoExtendManager(AutoExtendConfig(extension_seconds=600))
        now = datetime.now(timezone.utc)
        new_exp = mgr.get_new_expiration(now)
        assert (new_exp - now).total_seconds() == 600

    def test_cleanup(self):
        mgr = AutoExtendManager()
        mgr.record_activity("sb-1")
        mgr.mark_extended("sb-1")
        mgr.cleanup("sb-1")
        stats = mgr.get_stats("sb-1")
        assert stats["extension_count"] == 0
        assert stats["last_activity"] is None

    def test_disabled(self):
        mgr = AutoExtendManager(AutoExtendConfig(enabled=False))
        mgr.record_activity("sb-1")
        expires = datetime.now(timezone.utc) + timedelta(seconds=10)
        assert mgr.should_extend("sb-1", expires) is False

    def test_event_listener_records_activity(self):
        bus = EventBus()
        setup_auto_extend_listener(bus)
        mgr = get_auto_extend_manager()
        bus.publish(
            SandboxEvent(
                event_type=EventType.API_REQUEST,
                sandbox_id="sb-1",
            )
        )
        stats = mgr.get_stats("sb-1")
        assert stats["last_activity"] is not None

    def test_event_listener_cleanup_on_delete(self):
        bus = EventBus()
        setup_auto_extend_listener(bus)
        mgr = get_auto_extend_manager()
        mgr.record_activity("sb-1")
        mgr.mark_extended("sb-1")
        bus.publish(
            SandboxEvent(
                event_type=EventType.SANDBOX_DELETED,
                sandbox_id="sb-1",
            )
        )
        stats = mgr.get_stats("sb-1")
        assert stats["extension_count"] == 0

    def test_global_singleton(self):
        m1 = get_auto_extend_manager()
        m2 = get_auto_extend_manager()
        assert m1 is m2
