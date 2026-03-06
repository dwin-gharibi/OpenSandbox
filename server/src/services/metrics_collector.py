"""
Prometheus metrics collector for OpenSandbox.

Exposes request counts, latencies, sandbox lifecycle gauges,
and resource usage for Prometheus scraping.
"""

from __future__ import annotations

import logging

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

logger = logging.getLogger(__name__)

REGISTRY = CollectorRegistry(auto_describe=True)

SERVER_INFO = Info(
    "opensandbox_server",
    "OpenSandbox server information",
    registry=REGISTRY,
)
SERVER_INFO.info({"version": "0.2.0", "component": "lifecycle-api"})

REQUEST_COUNT = Counter(
    "opensandbox_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
    registry=REGISTRY,
)

REQUEST_LATENCY = Histogram(
    "opensandbox_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=REGISTRY,
)

SANDBOX_ACTIVE = Gauge(
    "opensandbox_sandboxes_active",
    "Number of currently active sandboxes",
    registry=REGISTRY,
)

SANDBOX_TOTAL_CREATED = Counter(
    "opensandbox_sandboxes_created_total",
    "Total sandboxes created",
    registry=REGISTRY,
)

SANDBOX_TOTAL_DELETED = Counter(
    "opensandbox_sandboxes_deleted_total",
    "Total sandboxes deleted",
    registry=REGISTRY,
)

SANDBOX_TOTAL_PAUSED = Counter(
    "opensandbox_sandboxes_paused_total",
    "Total sandboxes paused",
    registry=REGISTRY,
)

SANDBOX_TOTAL_RESUMED = Counter(
    "opensandbox_sandboxes_resumed_total",
    "Total sandboxes resumed",
    registry=REGISTRY,
)

SNAPSHOT_COUNT = Counter(
    "opensandbox_snapshots_created_total",
    "Total snapshots created",
    registry=REGISTRY,
)

CLONE_COUNT = Counter(
    "opensandbox_clones_created_total",
    "Total sandbox clones created",
    registry=REGISTRY,
)

WEBSOCKET_CONNECTIONS = Gauge(
    "opensandbox_websocket_connections_active",
    "Active WebSocket proxy connections",
    registry=REGISTRY,
)

RATE_LIMIT_HITS = Counter(
    "opensandbox_rate_limit_hits_total",
    "Total rate limit hits",
    ["api_key"],
    registry=REGISTRY,
)

WEBHOOK_DELIVERIES = Counter(
    "opensandbox_webhook_deliveries_total",
    "Total webhook deliveries",
    ["status"],
    registry=REGISTRY,
)

AUDIT_ENTRIES = Counter(
    "opensandbox_audit_entries_total",
    "Total audit log entries",
    registry=REGISTRY,
)


def get_metrics() -> bytes:
    return generate_latest(REGISTRY)


def get_content_type() -> str:
    return CONTENT_TYPE_LATEST
