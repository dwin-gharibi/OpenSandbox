"""Tests for the RBAC module."""

import pytest
from src.services.rbac import (
    RBACManager,
    ROLE_PERMISSIONS,
    get_rbac_manager,
    reset_rbac_manager,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_rbac_manager()
    yield
    reset_rbac_manager()


class TestRBACManager:
    def test_create_key(self):
        mgr = RBACManager()
        key = mgr.create_key(name="test-key", role="admin")
        assert key.name == "test-key"
        assert key.role == "admin"
        assert key.key.startswith("osk-")
        assert key.is_active is True

    def test_validate_key(self):
        mgr = RBACManager()
        key = mgr.create_key(name="test", role="user")
        result = mgr.validate_key(key.key)
        assert result is not None
        assert result.id == key.id

    def test_validate_invalid_key(self):
        mgr = RBACManager()
        assert mgr.validate_key("invalid") is None

    def test_check_permission_admin(self):
        mgr = RBACManager()
        key = mgr.create_key(name="admin-key", role="admin")
        assert mgr.check_permission(key.key, "sandbox:create") is True
        assert mgr.check_permission(key.key, "admin:keys") is True
        assert mgr.check_permission(key.key, "admin:audit") is True

    def test_check_permission_user(self):
        mgr = RBACManager()
        key = mgr.create_key(name="user-key", role="user")
        assert mgr.check_permission(key.key, "sandbox:create") is True
        assert mgr.check_permission(key.key, "admin:keys") is False

    def test_check_permission_viewer(self):
        mgr = RBACManager()
        key = mgr.create_key(name="viewer-key", role="viewer")
        assert mgr.check_permission(key.key, "sandbox:read") is True
        assert mgr.check_permission(key.key, "sandbox:create") is False
        assert mgr.check_permission(key.key, "admin:keys") is False

    def test_revoke_key(self):
        mgr = RBACManager()
        key = mgr.create_key(name="test", role="user")
        assert mgr.revoke_key(key.id) is True
        assert mgr.validate_key(key.key) is None

    def test_delete_key(self):
        mgr = RBACManager()
        key = mgr.create_key(name="test", role="user")
        assert mgr.delete_key(key.id) is True
        assert mgr.get_key(key.id) is None

    def test_delete_nonexistent_key(self):
        mgr = RBACManager()
        assert mgr.delete_key("nonexistent") is False

    def test_list_keys(self):
        mgr = RBACManager()
        mgr.create_key(name="key1", role="admin")
        mgr.create_key(name="key2", role="user")
        keys = mgr.list_keys()
        assert len(keys) == 2

    def test_update_key(self):
        mgr = RBACManager()
        key = mgr.create_key(name="old-name", role="user")
        updated = mgr.update_key(key.id, name="new-name", role="admin")
        assert updated is not None
        assert updated.name == "new-name"
        assert updated.role == "admin"

    def test_update_nonexistent_key(self):
        mgr = RBACManager()
        assert mgr.update_key("nonexistent", name="test") is None

    def test_load_from_config(self):
        mgr = RBACManager()
        mgr.load_from_config("my-api-key-123")
        result = mgr.validate_key("my-api-key-123")
        assert result is not None
        assert result.role == "admin"

    def test_load_from_config_empty(self):
        mgr = RBACManager()
        mgr.load_from_config("")
        assert len(mgr.list_keys()) == 0

    def test_last_used_at_updated(self):
        mgr = RBACManager()
        key = mgr.create_key(name="test", role="user")
        assert key.last_used_at is None
        mgr.validate_key(key.key)
        assert key.last_used_at is not None

    def test_global_singleton(self):
        m1 = get_rbac_manager()
        m2 = get_rbac_manager()
        assert m1 is m2

    def test_role_permissions_defined(self):
        assert "admin" in ROLE_PERMISSIONS
        assert "user" in ROLE_PERMISSIONS
        assert "viewer" in ROLE_PERMISSIONS
        assert len(ROLE_PERMISSIONS["admin"]) > len(ROLE_PERMISSIONS["user"])
        assert len(ROLE_PERMISSIONS["user"]) > len(ROLE_PERMISSIONS["viewer"])
