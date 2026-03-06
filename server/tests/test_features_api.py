"""Tests for the features API endpoints."""

import pytest
from fastapi.testclient import TestClient

from src.services.audit import reset_audit_log
from src.services.auto_extend import reset_auto_extend_manager
from src.services.cost_tracker import reset_cost_tracker
from src.services.event_bus import reset_event_bus
from src.services.health_monitor import reset_health_monitor
from src.services.rate_limiter import reset_rate_limiter
from src.services.rbac import reset_rbac_manager
from src.services.sharing import reset_sharing_manager
from src.services.snapshots import reset_snapshot_manager


@pytest.fixture(autouse=True)
def _reset_all():
    reset_event_bus()
    reset_audit_log()
    reset_cost_tracker()
    reset_auto_extend_manager()
    reset_health_monitor()
    reset_rate_limiter()
    reset_rbac_manager()
    reset_sharing_manager()
    reset_snapshot_manager()
    yield
    reset_event_bus()
    reset_audit_log()
    reset_cost_tracker()
    reset_auto_extend_manager()
    reset_health_monitor()
    reset_rate_limiter()
    reset_rbac_manager()
    reset_sharing_manager()
    reset_snapshot_manager()


class TestSnapshotEndpoints:
    def test_create_snapshot(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/sandboxes/sb-1/snapshots",
            json={"description": "test snapshot"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sandbox_id"] == "sb-1"
        assert data["description"] == "test snapshot"
        assert "id" in data

    def test_list_snapshots(self, client: TestClient, auth_headers: dict):
        client.post("/sandboxes/sb-1/snapshots", json={}, headers=auth_headers)
        resp = client.get("/sandboxes/sb-1/snapshots", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_get_snapshot(self, client: TestClient, auth_headers: dict):
        create_resp = client.post("/sandboxes/sb-1/snapshots", json={}, headers=auth_headers)
        snap_id = create_resp.json()["id"]
        resp = client.get(f"/snapshots/{snap_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == snap_id

    def test_get_nonexistent_snapshot(self, client: TestClient, auth_headers: dict):
        resp = client.get("/snapshots/nonexistent", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_snapshot(self, client: TestClient, auth_headers: dict):
        create_resp = client.post("/sandboxes/sb-1/snapshots", json={}, headers=auth_headers)
        snap_id = create_resp.json()["id"]
        resp = client.delete(f"/snapshots/{snap_id}", headers=auth_headers)
        assert resp.status_code == 204


class TestCloneEndpoint:
    def test_clone_sandbox(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/sandboxes/clone",
            json={"sourceSandboxId": "sb-1", "timeout": 3600},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["source_sandbox_id"] == "sb-1"
        assert data["status"] == "Pending"
        assert "id" in data


class TestMetricsEndpoint:
    def test_prometheus_metrics(self, client: TestClient):
        resp = client.get("/metrics/prometheus")
        assert resp.status_code == 200
        assert b"opensandbox" in resp.content


class TestRateLimitEndpoint:
    def test_get_rate_limit_info(self, client: TestClient, auth_headers: dict):
        resp = client.get("/rate-limit", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "limits" in data


class TestApiKeyEndpoints:
    def test_create_api_key(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/admin/api-keys",
            json={"name": "test-key", "role": "user"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test-key"
        assert data["role"] == "user"
        assert "key" in data

    def test_list_api_keys(self, client: TestClient, auth_headers: dict):
        client.post("/admin/api-keys", json={"name": "k1", "role": "user"}, headers=auth_headers)
        resp = client.get("/admin/api-keys", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_delete_api_key(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/admin/api-keys",
            json={"name": "to-delete", "role": "user"},
            headers=auth_headers,
        )
        key_id = create_resp.json()["id"]
        resp = client.delete(f"/admin/api-keys/{key_id}", headers=auth_headers)
        assert resp.status_code == 204

    def test_revoke_api_key(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/admin/api-keys",
            json={"name": "to-revoke", "role": "user"},
            headers=auth_headers,
        )
        key_id = create_resp.json()["id"]
        resp = client.post(f"/admin/api-keys/{key_id}/revoke", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "revoked"


class TestWebhookEndpoints:
    def test_register_webhook(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/admin/webhooks",
            json={"url": "https://example.com/hook", "secret": "s3cret"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["url"] == "https://example.com/hook"

    def test_list_webhooks(self, client: TestClient, auth_headers: dict):
        client.post(
            "/admin/webhooks",
            json={"url": "https://example.com/hook"},
            headers=auth_headers,
        )
        resp = client.get("/admin/webhooks", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_delete_webhook(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/admin/webhooks",
            json={"url": "https://example.com/hook"},
            headers=auth_headers,
        )
        wh_id = create_resp.json()["id"]
        resp = client.delete(f"/admin/webhooks/{wh_id}", headers=auth_headers)
        assert resp.status_code == 204


class TestAuditEndpoint:
    def test_query_audit_log(self, client: TestClient, auth_headers: dict):
        resp = client.get("/admin/audit", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data


class TestCostEndpoints:
    def test_cost_summary(self, client: TestClient, auth_headers: dict):
        resp = client.get("/admin/cost/summary", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_cost" in data

    def test_sandbox_cost(self, client: TestClient, auth_headers: dict):
        resp = client.get("/sandboxes/sb-1/cost", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sandbox_id"] == "sb-1"

    def test_cost_by_api_key(self, client: TestClient, auth_headers: dict):
        resp = client.get("/admin/cost/by-key?apiKey=test-key", headers=auth_headers)
        assert resp.status_code == 200


class TestSharingEndpoints:
    def test_create_share(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/sandboxes/sb-1/shares",
            json={"permissions": ["read", "write"], "label": "collab"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["sandbox_id"] == "sb-1"
        assert "token" in data

    def test_list_shares(self, client: TestClient, auth_headers: dict):
        client.post(
            "/sandboxes/sb-1/shares",
            json={"permissions": ["read"]},
            headers=auth_headers,
        )
        resp = client.get("/sandboxes/sb-1/shares", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_validate_share_token(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/sandboxes/sb-1/shares",
            json={"permissions": ["read"]},
            headers=auth_headers,
        )
        token = create_resp.json()["token"]
        resp = client.post(f"/shares/validate?token={token}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["sandbox_id"] == "sb-1"

    def test_validate_invalid_token(self, client: TestClient, auth_headers: dict):
        resp = client.post("/shares/validate?token=invalid", headers=auth_headers)
        assert resp.status_code == 401

    def test_revoke_share(self, client: TestClient, auth_headers: dict):
        create_resp = client.post(
            "/sandboxes/sb-1/shares",
            json={"permissions": ["read"]},
            headers=auth_headers,
        )
        share_id = create_resp.json()["id"]
        resp = client.delete(f"/shares/{share_id}", headers=auth_headers)
        assert resp.status_code == 204


class TestDashboardEndpoint:
    def test_health_dashboard(self, client: TestClient, auth_headers: dict):
        resp = client.get("/admin/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_sandboxes" in data
        assert "uptime_seconds" in data

    def test_sandbox_health(self, client: TestClient, auth_headers: dict):
        resp = client.get("/sandboxes/sb-1/health", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sandbox_id"] == "sb-1"


class TestAutoExtendEndpoint:
    def test_auto_extend_status(self, client: TestClient, auth_headers: dict):
        resp = client.get("/sandboxes/sb-1/auto-extend", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "extension_count" in data
        assert "enabled" in data


class TestErrorPaths:
    """Test error/404 paths for full coverage."""

    def test_delete_nonexistent_snapshot(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/snapshots/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404
        assert resp.json()["code"] == "SNAPSHOT_NOT_FOUND"

    def test_delete_nonexistent_api_key(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/admin/api-keys/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    def test_revoke_nonexistent_api_key(self, client: TestClient, auth_headers: dict):
        resp = client.post("/admin/api-keys/nonexistent-id/revoke", headers=auth_headers)
        assert resp.status_code == 404

    def test_delete_nonexistent_webhook(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/admin/webhooks/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    def test_revoke_nonexistent_share(self, client: TestClient, auth_headers: dict):
        resp = client.delete("/shares/nonexistent-id", headers=auth_headers)
        assert resp.status_code == 404

    def test_audit_with_filters(self, client: TestClient, auth_headers: dict):
        resp = client.get(
            "/admin/audit?actor=test&action=sandbox.created&limit=10&offset=0",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_cost_summary_with_dates(self, client: TestClient, auth_headers: dict):
        resp = client.get(
            "/admin/cost/summary?since=2025-01-01T00:00:00Z&until=2027-01-01T00:00:00Z",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    def test_metrics_endpoint_no_auth_needed(self, client: TestClient):
        """Prometheus metrics endpoint should be accessible without auth."""
        resp = client.get("/metrics/prometheus")
        assert resp.status_code == 200
        assert b"opensandbox" in resp.content

    def test_v1_prefix_features(self, client: TestClient, auth_headers: dict):
        """Feature endpoints should be accessible under /v1 prefix too."""
        resp = client.get("/v1/admin/dashboard", headers=auth_headers)
        assert resp.status_code == 200

    def test_clone_with_custom_timeout(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/sandboxes/clone",
            json={"sourceSandboxId": "sb-1", "timeout": 7200},
            headers=auth_headers,
        )
        assert resp.status_code == 201

    def test_create_share_with_expiry_and_max_uses(self, client: TestClient, auth_headers: dict):
        resp = client.post(
            "/sandboxes/sb-1/shares",
            json={
                "permissions": ["read"],
                "label": "temp",
                "expiresInHours": 24,
                "maxUses": 5,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["expires_at"] is not None
