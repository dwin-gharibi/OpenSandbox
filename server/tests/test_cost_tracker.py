"""Tests for the cost tracking module."""

import pytest
from src.services.cost_tracker import (
    CostRecord,
    CostTracker,
    get_cost_tracker,
    reset_cost_tracker,
    setup_cost_event_listener,
)
from src.services.event_bus import EventBus, EventType, SandboxEvent, reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_cost_tracker()
    reset_event_bus()
    yield
    reset_cost_tracker()
    reset_event_bus()


class TestCostTracker:
    def test_record_and_get_sandbox_cost(self):
        tracker = CostTracker()
        tracker.record(CostRecord(
            sandbox_id="sb-1", api_key="key1", resource_type="sandbox_hours",
            quantity=2.0, unit="hours", unit_cost=0.01, total_cost=0.02,
        ))
        result = tracker.get_sandbox_cost("sb-1")
        assert result["sandbox_id"] == "sb-1"
        assert result["total_cost"] == 0.02
        assert "sandbox_hours" in result["breakdown"]
        tracker.close()

    def test_record_sandbox_usage(self):
        tracker = CostTracker()
        tracker.record_sandbox_usage("sb-1", "key1", hours=1.0, cpu_seconds=3600)
        result = tracker.get_sandbox_cost("sb-1")
        assert result["total_cost"] > 0
        assert "sandbox_hours" in result["breakdown"]
        assert "cpu_seconds" in result["breakdown"]
        tracker.close()

    def test_get_api_key_cost(self):
        tracker = CostTracker()
        tracker.record(CostRecord(
            sandbox_id="sb-1", api_key="key1", resource_type="sandbox_hours",
            quantity=1.0, unit="hours", unit_cost=0.01, total_cost=0.01,
        ))
        tracker.record(CostRecord(
            sandbox_id="sb-2", api_key="key1", resource_type="sandbox_hours",
            quantity=2.0, unit="hours", unit_cost=0.01, total_cost=0.02,
        ))
        result = tracker.get_api_key_cost("key1")
        assert result["total_cost"] == 0.03
        tracker.close()

    def test_get_summary(self):
        tracker = CostTracker()
        tracker.record(CostRecord(
            sandbox_id="sb-1", api_key="k1", resource_type="sandbox_hours",
            quantity=1.0, unit="hours", unit_cost=0.01, total_cost=0.01,
        ))
        tracker.record(CostRecord(
            sandbox_id="sb-2", api_key="k2", resource_type="sandbox_hours",
            quantity=1.0, unit="hours", unit_cost=0.01, total_cost=0.01,
        ))
        result = tracker.get_summary()
        assert result["total_cost"] == 0.02
        assert result["sandbox_count"] == 2
        tracker.close()

    def test_set_custom_rate(self):
        tracker = CostTracker()
        tracker.set_rate("sandbox_hours", 0.05)
        tracker.record_sandbox_usage("sb-1", "key1", hours=1.0)
        result = tracker.get_sandbox_cost("sb-1")
        assert result["breakdown"]["sandbox_hours"] == 0.05
        tracker.close()

    def test_event_listener(self):
        bus = EventBus()
        setup_cost_event_listener(bus)
        tracker = get_cost_tracker()
        bus.publish(SandboxEvent(
            event_type=EventType.SANDBOX_SNAPSHOT_CREATED,
            sandbox_id="sb-1", actor="key1",
        ))
        result = tracker.get_sandbox_cost("sb-1")
        assert result["total_cost"] > 0

    def test_global_singleton(self):
        t1 = get_cost_tracker()
        t2 = get_cost_tracker()
        assert t1 is t2

    def test_empty_sandbox_cost(self):
        tracker = CostTracker()
        result = tracker.get_sandbox_cost("nonexistent")
        assert result["total_cost"] == 0
        tracker.close()
