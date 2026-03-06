"""Tests for the audit logging module."""

import pytest
from src.services.audit import (
    AuditEntry,
    AuditLog,
    get_audit_log,
    reset_audit_log,
    setup_audit_event_listener,
)
from src.services.event_bus import EventBus, EventType, SandboxEvent, reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_audit_log()
    reset_event_bus()
    yield
    reset_audit_log()
    reset_event_bus()


class TestAuditLog:
    def test_record_and_query(self):
        audit = AuditLog()
        entry = AuditEntry(actor="user1", action="sandbox.created", resource_id="sb-1")
        audit.record(entry)
        results = audit.query(actor="user1")
        assert len(results) == 1
        assert results[0]["actor"] == "user1"
        assert results[0]["resource_id"] == "sb-1"
        audit.close()

    def test_query_by_action(self):
        audit = AuditLog()
        audit.record(AuditEntry(actor="u1", action="sandbox.created", resource_id="sb-1"))
        audit.record(AuditEntry(actor="u1", action="sandbox.deleted", resource_id="sb-2"))
        results = audit.query(action="sandbox.deleted")
        assert len(results) == 1
        assert results[0]["resource_id"] == "sb-2"
        audit.close()

    def test_query_by_resource_id(self):
        audit = AuditLog()
        audit.record(AuditEntry(actor="u1", action="sandbox.created", resource_id="sb-1"))
        audit.record(AuditEntry(actor="u2", action="sandbox.created", resource_id="sb-2"))
        results = audit.query(resource_id="sb-1")
        assert len(results) == 1
        audit.close()

    def test_count(self):
        audit = AuditLog()
        for i in range(5):
            audit.record(AuditEntry(actor="u1", action="sandbox.created", resource_id=f"sb-{i}"))
        assert audit.count(actor="u1") == 5
        assert audit.count(actor="u2") == 0
        audit.close()

    def test_pagination(self):
        audit = AuditLog()
        for i in range(10):
            audit.record(AuditEntry(actor="u1", action="test", resource_id=f"r-{i}"))
        page1 = audit.query(limit=3, offset=0)
        page2 = audit.query(limit=3, offset=3)
        assert len(page1) == 3
        assert len(page2) == 3
        assert page1[0]["resource_id"] != page2[0]["resource_id"]
        audit.close()

    def test_details_stored_as_json(self):
        audit = AuditLog()
        audit.record(
            AuditEntry(
                actor="u1",
                action="test",
                resource_id="r-1",
                details={"key": "value", "nested": {"a": 1}},
            )
        )
        results = audit.query()
        assert results[0]["details"] == {"key": "value", "nested": {"a": 1}}
        audit.close()

    def test_event_listener_integration(self):
        bus = EventBus()
        setup_audit_event_listener(bus)
        audit = get_audit_log()
        bus.publish(
            SandboxEvent(
                event_type=EventType.SANDBOX_CREATED,
                sandbox_id="sb-1",
                actor="user1",
            )
        )
        results = audit.query()
        assert len(results) >= 1
        assert results[0]["action"] == "sandbox.created"

    def test_global_singleton(self):
        a1 = get_audit_log()
        a2 = get_audit_log()
        assert a1 is a2
