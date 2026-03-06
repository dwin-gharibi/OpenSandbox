"""
Prometheus metrics middleware for OpenSandbox.

Records request counts and latencies for all HTTP endpoints.
"""

import time
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from src.services.metrics_collector import REQUEST_COUNT, REQUEST_LATENCY
from src.services.health_monitor import get_health_monitor


class MetricsMiddleware(BaseHTTPMiddleware):
    """Records Prometheus metrics for every HTTP request."""

    SKIP_PATHS = {"/metrics/prometheus", "/health"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        method = request.method
        path = self._normalize_path(request.url.path)

        monitor = get_health_monitor()
        monitor.record_request()

        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start

        REQUEST_COUNT.labels(method=method, endpoint=path, status=str(response.status_code)).inc()
        REQUEST_LATENCY.labels(method=method, endpoint=path).observe(duration)

        response.headers["X-Response-Time"] = f"{duration:.4f}"
        return response

    @staticmethod
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
