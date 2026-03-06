"""
Prometheus metrics middleware for OpenSandbox.

Uses a pure ASGI middleware instead of BaseHTTPMiddleware to avoid
buffering streaming responses (SSE from proxy endpoints).
"""

import time

from starlette.types import ASGIApp, Receive, Scope, Send

from src.services.metrics_collector import REQUEST_COUNT, REQUEST_LATENCY
from src.services.health_monitor import get_health_monitor

SKIP_PREFIXES = ("/metrics/prometheus", "/health")
PROXY_MARKER = "/proxy/"


def _normalize_path(path: str) -> str:
    parts = path.strip("/").split("/")
    normalized = []
    skip_next = False
    for i, part in enumerate(parts):
        if skip_next:
            skip_next = False
            continue
        if part == "v1":
            continue
        if part == "sandboxes" and i + 1 < len(parts):
            normalized.append("sandboxes")
            normalized.append("{id}")
            skip_next = True
        else:
            normalized.append(part)
    return "/" + "/".join(normalized) if normalized else "/"


class MetricsMiddleware:
    """Pure ASGI middleware that records Prometheus metrics without buffering responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        if any(path.startswith(p) for p in SKIP_PREFIXES):
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        normalized = _normalize_path(path)

        monitor = get_health_monitor()
        monitor.record_request()

        start = time.perf_counter()
        status_code = 200

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 200)
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration = time.perf_counter() - start
            REQUEST_COUNT.labels(method=method, endpoint=normalized, status=str(status_code)).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=normalized).observe(duration)
