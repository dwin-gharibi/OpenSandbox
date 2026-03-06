"""
Sandbox health monitoring service.

Tracks health status of individual sandboxes and provides
aggregated health dashboard data.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

logger = logging.getLogger(__name__)

HealthStatus = Literal["healthy", "unhealthy", "degraded", "unknown"]


@dataclass
class SandboxHealth:
    sandbox_id: str = ""
    status: HealthStatus = "unknown"
    last_check: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    response_time_ms: float = 0.0
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    uptime_seconds: float = 0.0
    error_message: str = ""
    checks_passed: int = 0
    checks_failed: int = 0


@dataclass
class DashboardData:
    total_sandboxes: int = 0
    healthy: int = 0
    unhealthy: int = 0
    degraded: int = 0
    unknown: int = 0
    avg_response_time_ms: float = 0.0
    avg_cpu_percent: float = 0.0
    avg_memory_percent: float = 0.0
    total_snapshots: int = 0
    total_shares: int = 0
    total_api_keys: int = 0
    uptime_seconds: float = 0.0
    requests_per_minute: float = 0.0
    sandboxes: List[Dict[str, Any]] = field(default_factory=list)


class HealthMonitor:
    """Monitors sandbox health and provides dashboard data."""

    def __init__(self) -> None:
        self._health: Dict[str, SandboxHealth] = {}
        self._lock = threading.Lock()
        self._start_time = time.monotonic()
        self._request_count = 0
        self._request_times: List[float] = []

    def record_request(self) -> None:
        now = time.monotonic()
        with self._lock:
            self._request_count += 1
            self._request_times.append(now)
            cutoff = now - 60
            self._request_times = [t for t in self._request_times if t > cutoff]

    def update_health(self, sandbox_id: str, health: SandboxHealth) -> None:
        with self._lock:
            self._health[sandbox_id] = health

    def set_health_status(
        self,
        sandbox_id: str,
        status: HealthStatus,
        response_time_ms: float = 0.0,
        cpu_percent: float = 0.0,
        memory_percent: float = 0.0,
        error_message: str = "",
    ) -> SandboxHealth:
        with self._lock:
            existing = self._health.get(sandbox_id, SandboxHealth(sandbox_id=sandbox_id))
            existing.status = status
            existing.last_check = datetime.now(timezone.utc).isoformat()
            existing.response_time_ms = response_time_ms
            existing.cpu_percent = cpu_percent
            existing.memory_percent = memory_percent
            existing.error_message = error_message
            if status == "healthy":
                existing.checks_passed += 1
            else:
                existing.checks_failed += 1
            self._health[sandbox_id] = existing
            return existing

    def get_health(self, sandbox_id: str) -> Optional[SandboxHealth]:
        with self._lock:
            return self._health.get(sandbox_id)

    def remove_sandbox(self, sandbox_id: str) -> None:
        with self._lock:
            self._health.pop(sandbox_id, None)

    def get_dashboard(self) -> DashboardData:
        with self._lock:
            sandboxes = list(self._health.values())
            rpm = len(self._request_times)
            uptime = time.monotonic() - self._start_time

        healthy = sum(1 for s in sandboxes if s.status == "healthy")
        unhealthy = sum(1 for s in sandboxes if s.status == "unhealthy")
        degraded = sum(1 for s in sandboxes if s.status == "degraded")
        unknown = sum(1 for s in sandboxes if s.status == "unknown")

        avg_rt = sum(s.response_time_ms for s in sandboxes) / max(len(sandboxes), 1)
        avg_cpu = sum(s.cpu_percent for s in sandboxes) / max(len(sandboxes), 1)
        avg_mem = sum(s.memory_percent for s in sandboxes) / max(len(sandboxes), 1)

        sandbox_list = [
            {
                "sandbox_id": s.sandbox_id,
                "status": s.status,
                "last_check": s.last_check,
                "response_time_ms": s.response_time_ms,
                "cpu_percent": s.cpu_percent,
                "memory_percent": s.memory_percent,
            }
            for s in sandboxes
        ]

        return DashboardData(
            total_sandboxes=len(sandboxes),
            healthy=healthy,
            unhealthy=unhealthy,
            degraded=degraded,
            unknown=unknown,
            avg_response_time_ms=round(avg_rt, 2),
            avg_cpu_percent=round(avg_cpu, 2),
            avg_memory_percent=round(avg_mem, 2),
            uptime_seconds=round(uptime, 1),
            requests_per_minute=rpm,
            sandboxes=sandbox_list,
        )


_global_monitor: Optional[HealthMonitor] = None


def get_health_monitor() -> HealthMonitor:
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = HealthMonitor()
    return _global_monitor


def reset_health_monitor() -> None:
    global _global_monitor
    _global_monitor = None
