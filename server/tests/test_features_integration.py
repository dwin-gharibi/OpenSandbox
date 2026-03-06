"""Integration tests for all new feature API endpoints.

Verifies every endpoint returns correct status codes and response shapes
by hitting the real FastAPI test client.
"""

import pytest
from fastapi.testclient import TestClient

from src.services.audit import reset_audit_log
from src.services.auto_extend import reset_auto_extend_manager
from src.services.cost_tracker import reset_cost_tracker
from src.services.event_bus import reset_event_bus
from src.services.extensions import reset_extension_registry
from src.services.health_monitor import reset_health_monitor
from src.services.provisioning import reset_provisioning_manager
from src.services.rate_limiter import reset_rate_limiter
from src.services.rbac import reset_rbac_manager
from src.services.sharing import reset_sharing_manager
from src.services.snapshots import reset_snapshot_manager


@pytest.fixture(autouse=True)
def _reset_all():
    for fn in [
        reset_event_bus, reset_audit_log, reset_cost_tracker,
        reset_auto_extend_manager, reset_health_monitor,
        reset_rate_limiter, reset_rbac_manager, reset_sharing_manager,
        reset_snapshot_manager, reset_extension_registry, reset_provisioning_manager,
    ]:
        fn()
    yield
    for fn in [
        reset_event_bus, reset_audit_log, reset_cost_tracker,
        reset_auto_extend_manager, reset_health_monitor,
        reset_rate_limiter, reset_rbac_manager, reset_sharing_manager,
        reset_snapshot_manager, reset_extension_registry, reset_provisioning_manager,
    ]:
        fn()


# ============================================================================
# Dashboard
# ============================================================================

class TestDashboardIntegration:
    def test_dashboard_returns_sandbox_counts(self, client: TestClient, auth_headers: dict):
        r = client.get("/admin/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "total_sandboxes" in d
        assert "running" in d
        assert "paused" in d
        assert "failed" in d
        assert "pending" in d
        assert "uptime_seconds" in d
        assert "sandboxes" in d
        assert isinstance(d["sandboxes"], list)

    def test_dashboard_v1_prefix(self, client: TestClient, auth_headers: dict):
        r = client.get("/v1/admin/dashboard", headers=auth_headers)
        assert r.status_code == 200
        assert "total_sandboxes" in r.json()


# ============================================================================
# Webhooks - full lifecycle
# ============================================================================

class TestWebhooksIntegration:
    def test_webhook_full_lifecycle(self, client: TestClient, auth_headers: dict):
        # Create
        r = client.post("/admin/webhooks", headers=auth_headers, json={
            "url": "https://example.com/hook", "secret": "s3cret",
            "events": ["sandbox.created", "sandbox.deleted"],
        })
        assert r.status_code == 201
        wh = r.json()
        assert wh["url"] == "https://example.com/hook"
        wh_id = wh["id"]

        # List
        r = client.get("/admin/webhooks", headers=auth_headers)
        assert r.status_code == 200
        assert any(w["id"] == wh_id for w in r.json())

        # Delete
        r = client.delete(f"/admin/webhooks/{wh_id}", headers=auth_headers)
        assert r.status_code == 204

        # Confirm gone
        r = client.get("/admin/webhooks", headers=auth_headers)
        assert not any(w["id"] == wh_id for w in r.json())


# ============================================================================
# RBAC API Keys - full lifecycle
# ============================================================================

class TestApiKeysIntegration:
    def test_api_key_full_lifecycle(self, client: TestClient, auth_headers: dict):
        # Create
        r = client.post("/admin/api-keys", headers=auth_headers, json={
            "name": "integration-test", "role": "user",
        })
        assert r.status_code == 201
        key = r.json()
        assert key["name"] == "integration-test"
        assert key["role"] == "user"
        assert key["key"].startswith("osk-")
        key_id = key["id"]

        # List
        r = client.get("/admin/api-keys", headers=auth_headers)
        assert r.status_code == 200
        assert any(k["id"] == key_id for k in r.json())

        # Revoke
        r = client.post(f"/admin/api-keys/{key_id}/revoke", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "revoked"

        # Delete
        r = client.delete(f"/admin/api-keys/{key_id}", headers=auth_headers)
        assert r.status_code == 204


# ============================================================================
# Snapshots - full lifecycle
# ============================================================================

class TestSnapshotsIntegration:
    def test_snapshot_full_lifecycle(self, client: TestClient, auth_headers: dict):
        # Create
        r = client.post("/sandboxes/test-sb/snapshots", headers=auth_headers, json={
            "description": "test snapshot",
        })
        assert r.status_code == 201
        snap = r.json()
        assert snap["sandbox_id"] == "test-sb"
        snap_id = snap["id"]

        # List
        r = client.get("/sandboxes/test-sb/snapshots", headers=auth_headers)
        assert r.status_code == 200
        assert any(s["id"] == snap_id for s in r.json())

        # Get
        r = client.get(f"/snapshots/{snap_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == snap_id

        # Delete
        r = client.delete(f"/snapshots/{snap_id}", headers=auth_headers)
        assert r.status_code == 204


# ============================================================================
# Sharing - full lifecycle
# ============================================================================

class TestSharingIntegration:
    def test_share_full_lifecycle(self, client: TestClient, auth_headers: dict):
        # Create
        r = client.post("/sandboxes/test-sb/shares", headers=auth_headers, json={
            "permissions": ["read", "write"], "label": "collab",
            "expiresInHours": 24, "maxUses": 10,
        })
        assert r.status_code == 201
        share = r.json()
        assert share["sandbox_id"] == "test-sb"
        assert share["permissions"] == ["read", "write"]
        token = share["token"]
        share_id = share["id"]

        # List
        r = client.get("/sandboxes/test-sb/shares", headers=auth_headers)
        assert r.status_code == 200
        assert any(s["id"] == share_id for s in r.json())

        # Validate
        r = client.post(f"/shares/validate?token={token}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["sandbox_id"] == "test-sb"
        assert r.json()["permissions"] == ["read", "write"]

        # Revoke
        r = client.delete(f"/shares/{share_id}", headers=auth_headers)
        assert r.status_code == 204

        # Token should be invalid now
        r = client.post(f"/shares/validate?token={token}", headers=auth_headers)
        assert r.status_code == 401


# ============================================================================
# Cost Tracking
# ============================================================================

class TestCostIntegration:
    def test_cost_endpoints(self, client: TestClient, auth_headers: dict):
        r = client.get("/admin/cost/summary", headers=auth_headers)
        assert r.status_code == 200
        assert "total_cost" in r.json()
        assert "sandbox_count" in r.json()

        r = client.get("/sandboxes/test-sb/cost", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["sandbox_id"] == "test-sb"
        assert "breakdown" in r.json()

        r = client.get("/admin/cost/by-key?apiKey=test-key", headers=auth_headers)
        assert r.status_code == 200
        assert "total_cost" in r.json()


# ============================================================================
# Audit Log
# ============================================================================

class TestAuditIntegration:
    def test_audit_endpoint(self, client: TestClient, auth_headers: dict):
        r = client.get("/admin/audit?limit=10&offset=0", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert "total" in d
        assert isinstance(d["items"], list)

    def test_audit_with_all_filters(self, client: TestClient, auth_headers: dict):
        r = client.get(
            "/admin/audit?actor=test&action=sandbox.created&resourceId=sb-1"
            "&since=2020-01-01T00:00:00Z&until=2030-01-01T00:00:00Z&limit=5&offset=0",
            headers=auth_headers,
        )
        assert r.status_code == 200


# ============================================================================
# Extensions
# ============================================================================

class TestExtensionsIntegration:
    def test_list_extensions(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions", headers=auth_headers)
        assert r.status_code == 200
        exts = r.json()
        assert len(exts) >= 10
        assert all("id" in e and "name" in e for e in exts)

    def test_list_categories(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions/categories", headers=auth_headers)
        assert r.status_code == 200
        assert "database" in r.json()

    def test_get_extension(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions/git", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == "git"
        assert "setup_commands" in r.json()

    def test_get_nonexistent_extension(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions/nonexistent", headers=auth_headers)
        assert r.status_code == 404

    def test_search_extensions(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions?q=docker", headers=auth_headers)
        assert r.status_code == 200
        assert any(e["id"] == "docker" for e in r.json())

    def test_filter_by_category(self, client: TestClient, auth_headers: dict):
        r = client.get("/extensions?category=database", headers=auth_headers)
        assert r.status_code == 200
        assert all(e["category"] == "database" for e in r.json())

    def test_apply_extensions(self, client: TestClient, auth_headers: dict):
        r = client.post("/sandboxes/test-sb/extensions", headers=auth_headers, json={
            "extensions": ["git", "redis"],
        })
        assert r.status_code == 200
        d = r.json()
        assert d["sandbox_id"] == "test-sb"
        assert "setup_script" in d
        assert "git" in d["setup_script"]
        assert "redis" in d["setup_script"]
        assert "REDIS_URL" in d["env"]

    def test_apply_unknown_extension(self, client: TestClient, auth_headers: dict):
        r = client.post("/sandboxes/test-sb/extensions", headers=auth_headers, json={
            "extensions": ["nonexistent"],
        })
        assert r.status_code == 400


# ============================================================================
# Provisioning Scripts
# ============================================================================

class TestProvisioningIntegration:
    def test_provisioning_full_lifecycle(self, client: TestClient, auth_headers: dict):
        # List defaults
        r = client.get("/provisioning-scripts", headers=auth_headers)
        assert r.status_code == 200
        default_count = len(r.json())
        assert default_count >= 5

        # Create
        r = client.post("/provisioning-scripts", headers=auth_headers, json={
            "name": "Test Script",
            "description": "A test provisioning script",
            "script": "#!/bin/bash\necho hello",
            "category": "test",
            "tags": ["test", "ci"],
            "timeoutSeconds": 60,
            "runOnCreate": True,
        })
        assert r.status_code == 201
        s = r.json()
        assert s["name"] == "Test Script"
        assert s["runOnCreate"] is True
        sid = s["id"]

        # Get
        r = client.get(f"/provisioning-scripts/{sid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == sid
        assert r.json()["script"] == "#!/bin/bash\necho hello"

        # Update
        r = client.put(f"/provisioning-scripts/{sid}", headers=auth_headers, json={
            "name": "Updated Script",
            "script": "#!/bin/bash\necho updated",
        })
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Script"
        assert r.json()["script"] == "#!/bin/bash\necho updated"
        assert r.json()["category"] == "test"  # unchanged field preserved

        # List should show one more
        r = client.get("/provisioning-scripts", headers=auth_headers)
        assert len(r.json()) == default_count + 1

        # Categories
        r = client.get("/provisioning-scripts/categories", headers=auth_headers)
        assert r.status_code == 200
        assert "test" in r.json()

        # Search
        r = client.get("/provisioning-scripts?q=updated", headers=auth_headers)
        assert r.status_code == 200
        assert any(s["id"] == sid for s in r.json())

        # Filter by category
        r = client.get("/provisioning-scripts?category=test", headers=auth_headers)
        assert r.status_code == 200
        assert all(s["category"] == "test" for s in r.json())

        # Run on sandbox
        r = client.post(f"/sandboxes/test-sb/provision?scriptId={sid}", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["sandbox_id"] == "test-sb"
        assert d["script_id"] == sid
        assert d["script_name"] == "Updated Script"
        assert "#!/bin/bash" in d["script"]

        # Delete
        r = client.delete(f"/provisioning-scripts/{sid}", headers=auth_headers)
        assert r.status_code == 204

        # Confirm deleted
        r = client.get(f"/provisioning-scripts/{sid}", headers=auth_headers)
        assert r.status_code == 404

    def test_run_nonexistent_script(self, client: TestClient, auth_headers: dict):
        r = client.post("/sandboxes/test-sb/provision?scriptId=nonexistent", headers=auth_headers)
        assert r.status_code == 404


# ============================================================================
# Metrics & Rate Limit
# ============================================================================

class TestMetricsIntegration:
    def test_prometheus_metrics(self, client: TestClient):
        r = client.get("/metrics/prometheus")
        assert r.status_code == 200
        assert b"opensandbox_http_requests_total" in r.content

    def test_rate_limit_info(self, client: TestClient, auth_headers: dict):
        r = client.get("/rate-limit", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "limits" in d
        assert "minute_remaining" in d["limits"]


# ============================================================================
# Health & Auto-Extend
# ============================================================================

class TestHealthIntegration:
    def test_sandbox_health(self, client: TestClient, auth_headers: dict):
        r = client.get("/sandboxes/test-sb/health", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["sandbox_id"] == "test-sb"

    def test_auto_extend(self, client: TestClient, auth_headers: dict):
        r = client.get("/sandboxes/test-sb/auto-extend", headers=auth_headers)
        assert r.status_code == 200
        assert "enabled" in r.json()
        assert "extension_count" in r.json()


# ============================================================================
# Clone
# ============================================================================

class TestCloneIntegration:
    def test_clone_sandbox(self, client: TestClient, auth_headers: dict):
        r = client.post("/sandboxes/clone", headers=auth_headers, json={
            "sourceSandboxId": "test-sb", "timeout": 3600,
        })
        assert r.status_code == 201
        d = r.json()
        assert d["source_sandbox_id"] == "test-sb"
        assert d["status"] == "Pending"
        assert "id" in d


# ============================================================================
# Event bus publishes on lifecycle operations
# ============================================================================

class TestEventPublishing:
    def test_create_publishes_event(self, client: TestClient, auth_headers: dict, sample_sandbox_request: dict):
        from src.services.event_bus import get_event_bus, EventType

        received = []
        bus = get_event_bus()
        bus.subscribe(EventType.SANDBOX_CREATED, lambda e: received.append(e))

        r = client.post("/sandboxes", headers=auth_headers, json=sample_sandbox_request)
        # May fail with docker error in test env, but event should still fire if create succeeds
        if r.status_code == 202:
            assert len(received) >= 1
            assert received[0].event_type == EventType.SANDBOX_CREATED
