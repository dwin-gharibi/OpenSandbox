"""
Rate limiting service for OpenSandbox.

Provides per-API-key rate limiting with configurable limits
and sliding window tracking.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from src.services.metrics_collector import RATE_LIMIT_HITS

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    sandbox_creates_per_hour: int = 100
    burst_size: int = 10


class SlidingWindowCounter:
    """Sliding window rate limiter."""

    def __init__(self, window_seconds: int, max_requests: int) -> None:
        self._window = window_seconds
        self._max = max_requests
        self._requests: List[float] = []
        self._lock = threading.Lock()

    def allow(self) -> Tuple[bool, int]:
        now = time.monotonic()
        with self._lock:
            cutoff = now - self._window
            self._requests = [t for t in self._requests if t > cutoff]
            remaining = max(0, self._max - len(self._requests))
            if len(self._requests) >= self._max:
                return False, 0
            self._requests.append(now)
            return True, remaining - 1

    @property
    def remaining(self) -> int:
        now = time.monotonic()
        with self._lock:
            cutoff = now - self._window
            active = [t for t in self._requests if t > cutoff]
            return max(0, self._max - len(active))


class RateLimiter:
    """Per-key rate limiter with multiple windows."""

    def __init__(self, config: Optional[RateLimitConfig] = None) -> None:
        self._config = config or RateLimitConfig()
        self._minute_windows: Dict[str, SlidingWindowCounter] = {}
        self._hour_windows: Dict[str, SlidingWindowCounter] = {}
        self._create_windows: Dict[str, SlidingWindowCounter] = {}
        self._lock = threading.Lock()

    def _get_or_create(
        self, store: Dict[str, SlidingWindowCounter], key: str, window: int, max_req: int
    ) -> SlidingWindowCounter:
        with self._lock:
            if key not in store:
                store[key] = SlidingWindowCounter(window, max_req)
            return store[key]

    def check_rate_limit(
        self, api_key: str, is_create: bool = False, custom_limit: Optional[int] = None
    ) -> Tuple[bool, Dict[str, int]]:
        per_min = custom_limit or self._config.requests_per_minute
        minute_counter = self._get_or_create(self._minute_windows, api_key, 60, per_min)
        hour_counter = self._get_or_create(
            self._hour_windows, api_key, 3600, self._config.requests_per_hour
        )

        min_ok, min_remaining = minute_counter.allow()
        hour_ok, hour_remaining = hour_counter.allow()

        info = {
            "minute_remaining": min_remaining,
            "hour_remaining": hour_remaining,
        }

        if is_create:
            create_counter = self._get_or_create(
                self._create_windows, api_key, 3600, self._config.sandbox_creates_per_hour
            )
            create_ok, create_remaining = create_counter.allow()
            info["create_remaining"] = create_remaining
            if not create_ok:
                RATE_LIMIT_HITS.labels(api_key=api_key[:8]).inc()
                return False, info

        if not min_ok or not hour_ok:
            RATE_LIMIT_HITS.labels(api_key=api_key[:8]).inc()
            return False, info

        return True, info

    def get_limits_info(self, api_key: str) -> Dict[str, int]:
        minute_counter = self._minute_windows.get(api_key)
        hour_counter = self._hour_windows.get(api_key)
        create_counter = self._create_windows.get(api_key)
        return {
            "minute_remaining": minute_counter.remaining if minute_counter else self._config.requests_per_minute,
            "hour_remaining": hour_counter.remaining if hour_counter else self._config.requests_per_hour,
            "create_remaining": create_counter.remaining if create_counter else self._config.sandbox_creates_per_hour,
        }


_global_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    global _global_limiter
    if _global_limiter is None:
        _global_limiter = RateLimiter()
    return _global_limiter


def reset_rate_limiter() -> None:
    global _global_limiter
    _global_limiter = None
