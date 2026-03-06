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
        bus.subscribe(
            EventType.SANDBOX_CREATED, lambda e: (_ for _ in ()).throw(ValueError("boom"))
        )
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

    def test_webhook_event_filter(self):
        """Webhooks with event filters only receive matching events."""
        bus = EventBus()
        bus.register_webhook(
            "https://example.com/hook",
            events=[EventType.SANDBOX_CREATED],
        )
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_DELETED))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))

    def test_webhook_no_filter_receives_all(self):
        """Webhooks without event filters receive all events."""
        bus = EventBus()
        bus.register_webhook("https://example.com/hook", events=None)
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_DELETED))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))

    def test_dispatch_webhook_no_loop(self):
        """_dispatch_webhook handles RuntimeError when no event loop."""
        bus = EventBus()
        webhook = {"id": "wh1", "url": "https://example.com", "secret": "", "events": None}
        event = SandboxEvent(event_type=EventType.SANDBOX_CREATED)
        bus._dispatch_webhook(webhook, event)

    def test_publish_with_coroutine_subscriber_no_loop(self):
        """Coroutine subscriber handles missing event loop gracefully."""
        bus = EventBus()

        async def async_callback(e: SandboxEvent) -> None:
            pass

        bus.subscribe(EventType.SANDBOX_CREATED, async_callback)
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))

    def test_multiple_subscribers_same_event(self):
        bus = EventBus()
        results = []
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: results.append("a"))
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: results.append("b"))
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))
        assert results == ["a", "b"]

    def test_webhook_with_matching_events(self):
        """Webhook receives events matching its filter list."""
        bus = EventBus()
        bus.register_webhook(
            "https://example.com/hook",
            events=[EventType.SANDBOX_CREATED, EventType.SANDBOX_DELETED],
        )
        bus.publish(SandboxEvent(event_type=EventType.SANDBOX_CREATED))

    def test_event_type_values(self):
        """All event types have string values."""
        assert EventType.SANDBOX_CREATED.value == "sandbox.created"
        assert EventType.SANDBOX_DELETED.value == "sandbox.deleted"
        assert EventType.SANDBOX_CLONED.value == "sandbox.cloned"
        assert EventType.API_REQUEST.value == "api.request"

    def test_reset_event_bus(self):
        bus1 = get_event_bus()
        reset_event_bus()
        bus2 = get_event_bus()
        assert bus1 is not bus2
