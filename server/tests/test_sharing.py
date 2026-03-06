"""Tests for the sharing module."""

import pytest
from src.services.sharing import SharingManager, get_sharing_manager, reset_sharing_manager
from src.services.event_bus import reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_sharing_manager()
    reset_event_bus()
    yield
    reset_sharing_manager()
    reset_event_bus()


class TestSharingManager:
    def test_create_share(self):
        mgr = SharingManager()
        share = mgr.create_share(sandbox_id="sb-1", permissions=["read", "write"], label="test")
        assert share.sandbox_id == "sb-1"
        assert share.permissions == ["read", "write"]
        assert share.token
        assert share.label == "test"

    def test_validate_token(self):
        mgr = SharingManager()
        share = mgr.create_share(sandbox_id="sb-1", permissions=["read"])
        result = mgr.validate_token(share.token)
        assert result is not None
        assert result.sandbox_id == "sb-1"
        assert result.use_count == 1

    def test_validate_invalid_token(self):
        mgr = SharingManager()
        assert mgr.validate_token("invalid-token") is None

    def test_max_uses(self):
        mgr = SharingManager()
        share = mgr.create_share(sandbox_id="sb-1", permissions=["read"], max_uses=2)
        assert mgr.validate_token(share.token) is not None
        assert mgr.validate_token(share.token) is not None
        assert mgr.validate_token(share.token) is None

    def test_list_shares(self):
        mgr = SharingManager()
        mgr.create_share(sandbox_id="sb-1", permissions=["read"])
        mgr.create_share(sandbox_id="sb-1", permissions=["write"])
        mgr.create_share(sandbox_id="sb-2", permissions=["read"])
        shares = mgr.list_shares("sb-1")
        assert len(shares) == 2

    def test_revoke_share(self):
        mgr = SharingManager()
        share = mgr.create_share(sandbox_id="sb-1", permissions=["read"])
        assert mgr.revoke_share(share.id) is True
        assert mgr.validate_token(share.token) is None

    def test_revoke_nonexistent_share(self):
        mgr = SharingManager()
        assert mgr.revoke_share("nonexistent") is False

    def test_revoke_all_shares(self):
        mgr = SharingManager()
        mgr.create_share(sandbox_id="sb-1", permissions=["read"])
        mgr.create_share(sandbox_id="sb-1", permissions=["write"])
        count = mgr.revoke_all_shares("sb-1")
        assert count == 2
        assert len(mgr.list_shares("sb-1")) == 0

    def test_expired_share(self):
        mgr = SharingManager()
        share = mgr.create_share(
            sandbox_id="sb-1", permissions=["read"], expires_in_hours=0,
        )
        # Set expiration to past
        import datetime
        past = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)).isoformat()
        share.expires_at = past
        result = mgr.validate_token(share.token)
        assert result is None

    def test_global_singleton(self):
        m1 = get_sharing_manager()
        m2 = get_sharing_manager()
        assert m1 is m2
