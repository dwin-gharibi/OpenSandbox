"""
In-process event bus for sandbox lifecycle events.

Supports synchronous and asynchronous subscribers. Events are dispatched
to registered webhooks and internal consumers (audit log, auto-extension, etc.).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    SANDBOX_CREATED = "sandbox.created"
    SANDBOX_DELETED = "sandbox.deleted"
    SANDBOX_PAUSED = "sandbox.paused"
    SANDBOX_RESUMED = "sandbox.resumed"
    SANDBOX_EXPIRED = "sandbox.expired"
    SANDBOX_SNAPSHOT_CREATED = "sandbox.snapshot.created"
    SANDBOX_CLONED = "sandbox.cloned"
    SANDBOX_SHARED = "sandbox.shared"
    SANDBOX_EXPIRATION_RENEWED = "sandbox.expiration.renewed"
    SANDBOX_EXPIRATION_AUTO_EXTENDED = "sandbox.expiration.auto_extended"
    SANDBOX_HEALTH_CHANGED = "sandbox.health.changed"
    API_REQUEST = "api.request"


@dataclass
class SandboxEvent:
    id: str = field(default_factory=lambda: uuid4().hex)
    event_type: EventType = EventType.SANDBOX_CREATED
    sandbox_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    actor: str = ""
    data: Dict[str, Any] = field(default_factory=dict)


Subscriber = Callable[[SandboxEvent], Any]


class EventBus:
    """Simple in-process pub/sub for sandbox events.

    Subscribers can register for specific event types or use None for wildcard.
    Webhooks are dispatched asynchronously when an event loop is available.
    """

    def __init__(self) -> None:
        self._subscribers: Dict[Optional[EventType], List[Subscriber]] = {}
        self._webhooks: List[Dict[str, Any]] = []

    def subscribe(self, event_type: Optional[EventType], callback: Subscriber) -> None:
        """Register a callback for a specific event type, or None for all events.

        Args:
            event_type: The event type to listen for, or None for all events.
            callback: Function called with SandboxEvent when a matching event fires.
        """
        self._subscribers.setdefault(event_type, []).append(callback)

    def unsubscribe(self, event_type: Optional[EventType], callback: Subscriber) -> None:
        """Remove a previously registered callback.

        Args:
            event_type: The event type the callback was registered for.
            callback: The callback to remove.
        """
        subs = self._subscribers.get(event_type, [])
        if callback in subs:
            subs.remove(callback)

    def register_webhook(
        self, url: str, events: Optional[List[EventType]] = None, secret: str = ""
    ) -> str:
        """Register a webhook endpoint for event delivery.

        Args:
            url: The HTTP(S) URL to deliver events to.
            events: Optional filter list; None means all events.
            secret: Shared secret for HMAC signature verification.

        Returns:
            The webhook ID for later management.
        """
        webhook_id = uuid4().hex
        self._webhooks.append(
            {
                "id": webhook_id,
                "url": url,
                "events": events,
                "secret": secret,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        return webhook_id

    def unregister_webhook(self, webhook_id: str) -> bool:
        before = len(self._webhooks)
        self._webhooks = [w for w in self._webhooks if w["id"] != webhook_id]
        return len(self._webhooks) < before

    def list_webhooks(self) -> List[Dict[str, Any]]:
        return list(self._webhooks)

    def publish(self, event: SandboxEvent) -> None:
        """Publish an event to all matching subscribers and webhooks.

        Args:
            event: The sandbox event to broadcast.
        """
        all_subs = self._subscribers.get(None, []) + self._subscribers.get(event.event_type, [])
        for sub in all_subs:
            try:
                result = sub(event)
                if asyncio.iscoroutine(result):
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(result)
                    except RuntimeError:
                        pass
            except Exception:
                logger.exception("Event subscriber error for %s", event.event_type)

        for webhook in self._webhooks:
            if webhook["events"] is None or event.event_type in webhook["events"]:
                self._dispatch_webhook(webhook, event)

    def _dispatch_webhook(self, webhook: Dict[str, Any], event: SandboxEvent) -> None:
        import threading

        payload = {
            "id": event.id,
            "type": event.event_type.value,
            "sandbox_id": event.sandbox_id,
            "timestamp": event.timestamp.isoformat(),
            "actor": event.actor,
            "data": event.data,
        }
        t = threading.Thread(
            target=self._send_webhook_sync, args=(webhook, payload), daemon=True
        )
        t.start()

    @staticmethod
    def _send_webhook_sync(webhook: Dict[str, Any], payload: Dict[str, Any]) -> None:
        import hashlib
        import json
        import urllib.request

        try:
            data = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if webhook.get("secret"):
                sig = hashlib.sha256(
                    (webhook["secret"] + json.dumps(payload, sort_keys=True)).encode()
                ).hexdigest()
                headers["X-Webhook-Signature"] = sig
            req = urllib.request.Request(
                webhook["url"], data=data, headers=headers, method="POST"
            )
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            logger.warning("Webhook delivery failed to %s", webhook["url"])


_global_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    global _global_bus
    if _global_bus is None:
        _global_bus = EventBus()
    return _global_bus


def reset_event_bus() -> None:
    global _global_bus
    _global_bus = None
