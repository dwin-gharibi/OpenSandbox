"""Tests for the Prometheus metrics collector."""

from src.services.metrics_collector import (
    REQUEST_COUNT,
    REQUEST_LATENCY,
    SANDBOX_ACTIVE,
    SNAPSHOT_COUNT,
    CLONE_COUNT,
    WEBSOCKET_CONNECTIONS,
    get_metrics,
    get_content_type,
)


class TestMetricsCollector:
    def test_get_metrics_returns_bytes(self):
        data = get_metrics()
        assert isinstance(data, bytes)
        assert len(data) > 0

    def test_content_type(self):
        ct = get_content_type()
        assert "text/plain" in ct or "openmetrics" in ct

    def test_request_counter(self):
        before = REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200")._value.get()
        REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200").inc()
        after = REQUEST_COUNT.labels(method="GET", endpoint="/test", status="200")._value.get()
        assert after == before + 1

    def test_sandbox_active_gauge(self):
        SANDBOX_ACTIVE.set(5)
        assert SANDBOX_ACTIVE._value.get() == 5
        SANDBOX_ACTIVE.dec()
        assert SANDBOX_ACTIVE._value.get() == 4

    def test_histogram_observation(self):
        REQUEST_LATENCY.labels(method="GET", endpoint="/test").observe(0.5)
        data = get_metrics()
        assert b"opensandbox_http_request_duration_seconds" in data

    def test_snapshot_counter(self):
        before = SNAPSHOT_COUNT._value.get()
        SNAPSHOT_COUNT.inc()
        assert SNAPSHOT_COUNT._value.get() == before + 1

    def test_clone_counter(self):
        before = CLONE_COUNT._value.get()
        CLONE_COUNT.inc()
        assert CLONE_COUNT._value.get() == before + 1

    def test_websocket_gauge(self):
        WEBSOCKET_CONNECTIONS.inc()
        val = WEBSOCKET_CONNECTIONS._value.get()
        assert val >= 1
        WEBSOCKET_CONNECTIONS.dec()

    def test_metrics_contain_server_info(self):
        data = get_metrics()
        assert b"opensandbox_server_info" in data

    def test_metrics_contain_all_families(self):
        data = get_metrics().decode()
        assert "opensandbox_http_requests_total" in data
        assert "opensandbox_sandboxes_active" in data
        assert "opensandbox_sandboxes_created_total" in data
