"""Tests for the rate limiting module."""

import pytest
from src.services.rate_limiter import (
    RateLimitConfig,
    RateLimiter,
    SlidingWindowCounter,
    get_rate_limiter,
    reset_rate_limiter,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limiter()
    yield
    reset_rate_limiter()


class TestSlidingWindowCounter:
    def test_allows_within_limit(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=5)
        for _ in range(5):
            allowed, remaining = counter.allow()
            assert allowed is True
        assert counter.remaining == 0

    def test_rejects_over_limit(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=3)
        for _ in range(3):
            counter.allow()
        allowed, remaining = counter.allow()
        assert allowed is False
        assert remaining == 0

    def test_remaining_property(self):
        counter = SlidingWindowCounter(window_seconds=60, max_requests=10)
        assert counter.remaining == 10
        counter.allow()
        assert counter.remaining == 9


class TestRateLimiter:
    def test_allows_normal_request(self):
        limiter = RateLimiter(RateLimitConfig(requests_per_minute=100))
        allowed, info = limiter.check_rate_limit("key1")
        assert allowed is True
        assert "minute_remaining" in info

    def test_rejects_over_limit(self):
        limiter = RateLimiter(RateLimitConfig(requests_per_minute=3, requests_per_hour=1000))
        for _ in range(3):
            limiter.check_rate_limit("key1")
        allowed, info = limiter.check_rate_limit("key1")
        assert allowed is False

    def test_separate_keys_have_separate_limits(self):
        limiter = RateLimiter(RateLimitConfig(requests_per_minute=2))
        limiter.check_rate_limit("key1")
        limiter.check_rate_limit("key1")
        allowed1, _ = limiter.check_rate_limit("key1")
        allowed2, _ = limiter.check_rate_limit("key2")
        assert allowed1 is False
        assert allowed2 is True

    def test_create_rate_limit(self):
        limiter = RateLimiter(RateLimitConfig(sandbox_creates_per_hour=2))
        limiter.check_rate_limit("key1", is_create=True)
        limiter.check_rate_limit("key1", is_create=True)
        allowed, info = limiter.check_rate_limit("key1", is_create=True)
        assert allowed is False
        assert "create_remaining" in info

    def test_custom_limit(self):
        limiter = RateLimiter(RateLimitConfig(requests_per_minute=100))
        for _ in range(5):
            limiter.check_rate_limit("key1", custom_limit=5)
        allowed, _ = limiter.check_rate_limit("key1", custom_limit=5)
        assert allowed is False

    def test_get_limits_info(self):
        limiter = RateLimiter()
        info = limiter.get_limits_info("key1")
        assert "minute_remaining" in info
        assert "hour_remaining" in info
        assert "create_remaining" in info

    def test_global_singleton(self):
        l1 = get_rate_limiter()
        l2 = get_rate_limiter()
        assert l1 is l2
