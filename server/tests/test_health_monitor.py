"""Tests for the health monitoring module."""

import pytest
from src.services.health_monitor import (
    HealthMonitor,
    get_health_monitor,
    reset_health_monitor,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_health_monitor()
    yield
    reset_health_monitor()


class TestHealthMonitor:
    def test_set_health_status(self):
        monitor = HealthMonitor()
        health = monitor.set_health_status(
            sandbox_id="sb-1",
            status="healthy",
            response_time_ms=50.0,
            cpu_percent=25.0,
            memory_percent=40.0,
        )
        assert health.status == "healthy"
        assert health.checks_passed == 1
        assert health.response_time_ms == 50.0

    def test_get_health(self):
        monitor = HealthMonitor()
        monitor.set_health_status("sb-1", "healthy")
        result = monitor.get_health("sb-1")
        assert result is not None
        assert result.status == "healthy"

    def test_get_health_nonexistent(self):
        monitor = HealthMonitor()
        assert monitor.get_health("nonexistent") is None

    def test_remove_sandbox(self):
        monitor = HealthMonitor()
        monitor.set_health_status("sb-1", "healthy")
        monitor.remove_sandbox("sb-1")
        assert monitor.get_health("sb-1") is None

    def test_get_dashboard(self):
        monitor = HealthMonitor()
        monitor.set_health_status("sb-1", "healthy", response_time_ms=100, cpu_percent=50)
        monitor.set_health_status("sb-2", "unhealthy", error_message="timeout")
        monitor.set_health_status("sb-3", "degraded")
        dashboard = monitor.get_dashboard()
        assert dashboard.total_sandboxes == 3
        assert dashboard.healthy == 1
        assert dashboard.unhealthy == 1
        assert dashboard.degraded == 1
        assert dashboard.uptime_seconds >= 0

    def test_dashboard_averages(self):
        monitor = HealthMonitor()
        monitor.set_health_status("sb-1", "healthy", cpu_percent=20, memory_percent=30)
        monitor.set_health_status("sb-2", "healthy", cpu_percent=40, memory_percent=50)
        dashboard = monitor.get_dashboard()
        assert dashboard.avg_cpu_percent == 30.0
        assert dashboard.avg_memory_percent == 40.0

    def test_record_request(self):
        monitor = HealthMonitor()
        for _ in range(10):
            monitor.record_request()
        dashboard = monitor.get_dashboard()
        assert dashboard.requests_per_minute == 10

    def test_update_health_overwrites(self):
        monitor = HealthMonitor()
        monitor.set_health_status("sb-1", "healthy")
        monitor.set_health_status("sb-1", "unhealthy", error_message="crash")
        health = monitor.get_health("sb-1")
        assert health.status == "unhealthy"
        assert health.checks_passed == 1
        assert health.checks_failed == 1

    def test_empty_dashboard(self):
        monitor = HealthMonitor()
        dashboard = monitor.get_dashboard()
        assert dashboard.total_sandboxes == 0
        assert dashboard.avg_cpu_percent == 0.0

    def test_global_singleton(self):
        m1 = get_health_monitor()
        m2 = get_health_monitor()
        assert m1 is m2
