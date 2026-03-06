"""Tests for the event bus module."""

import pytest
from src.services.event_bus import EventBus, EventType, SandboxEvent, get_event_bus, reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_event_bus()
    yield
    reset_event_bus()


class TestEventBus:
    def test_subscribe_and_publish(self):
        bus = EventBus()
        received = []
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: received.append(e))
        event = SandboxEvent(event_type=EventType.SANDBOX_CREATED, sandbox_id="sb-1")
        bus.publish(event)
        assert len(received) == 1
        assert received[0].sandbox_id == "sb-1"

    def test_wildcard_subscriber(self):
        bus = EventBus()
        received = []
        bus.subscribe(None, lambda e: received.append(e))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED, sandbox_id="sb-1"))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_DELETED, sandbox_id="sb-2"))
        assert len(received) == 2

    def test_unsubscribe(self):
        bus = EventBus()
        received = []
        def cb(e):
            return received.append(e)
        bus.subscribe(EventType.SANDBOX_CREATED, cb)
        bus.unsubscribe(EventType.SANDBOX_CREATED, cb)
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))
        assert len(received) == 0

    def test_register_and_list_webhooks(self):
        bus = EventBus()
        wh_id = bus.register_webhook("https://example.com/hook", secret="s3cret")
        webhooks = bus.list_webhooks()
        assert len(webhooks) == 1
        assert webhooks[0]["id"] == wh_id
        assert webhooks[0]["url"] == "https://example.com/hook"

    def test_unregister_webhook(self):
        bus = EventBus()
        wh_id = bus.register_webhook("https://example.com/hook")
        assert bus.unregister_webhook(wh_id) is True
        assert len(bus.list_webhooks()) == 0

    def test_unregister_nonexistent_webhook(self):
        bus = EventBus()
        assert bus.unregister_webhook("nonexistent") is False

    def test_subscriber_exception_does_not_crash(self):
        bus = EventBus()
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: (_ for _ in ()).throw(ValueError("boom")))
        received = []
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: received.append(e))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))
        assert len(received) == 1

    def test_global_event_bus_singleton(self):
        bus1 = get_event_bus()
        bus2 = get_event_bus()
        assert bus1 is bus2

    def test_event_has_defaults(self):
        event = SandboxEvent()
        assert event.id
        assert event.timestamp
        assert event.event_type == EventType.SANDBOX_CREATED
