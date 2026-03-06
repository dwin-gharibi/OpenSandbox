"""Tests for the provisioning scripts module."""

import pytest
from src.services.provisioning import (
    ProvisioningScript,
    ProvisioningManager,
    get_provisioning_manager,
    reset_provisioning_manager,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_provisioning_manager()
    yield
    reset_provisioning_manager()


class TestProvisioningManager:
    def test_defaults_loaded(self):
        mgr = ProvisioningManager()
        scripts = mgr.list_all()
        assert len(scripts) >= 5

    def test_create_script(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(
            name="test", description="a test script", script="echo hello",
            category="test", tags=["test"],
        ))
        assert s.id
        assert s.name == "test"
        assert mgr.get(s.id) is not None

    def test_get_nonexistent(self):
        mgr = ProvisioningManager()
        assert mgr.get("nonexistent") is None

    def test_list_by_category(self):
        mgr = ProvisioningManager()
        dev_scripts = mgr.list_all(category="development")
        assert len(dev_scripts) >= 2
        assert all(s.category == "development" for s in dev_scripts)

    def test_list_by_tag(self):
        mgr = ProvisioningManager()
        py_scripts = mgr.list_all(tag="python")
        assert len(py_scripts) >= 1

    def test_search(self):
        mgr = ProvisioningManager()
        results = mgr.search("python")
        assert len(results) >= 1

    def test_update_script(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(name="old", script="echo old"))
        updated = mgr.update(s.id, name="new", script="echo new")
        assert updated is not None
        assert updated.name == "new"
        assert updated.script == "echo new"

    def test_update_nonexistent(self):
        mgr = ProvisioningManager()
        assert mgr.update("nonexistent", name="x") is None

    def test_delete_script(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(name="delete-me", script="echo bye"))
        assert mgr.delete(s.id) is True
        assert mgr.get(s.id) is None

    def test_delete_nonexistent(self):
        mgr = ProvisioningManager()
        assert mgr.delete("nonexistent") is False

    def test_get_categories(self):
        mgr = ProvisioningManager()
        cats = mgr.get_categories()
        assert "development" in cats
        assert "security" in cats

    def test_update_partial(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(
            name="partial", script="echo test", category="old", tags=["a"],
        ))
        mgr.update(s.id, category="new")
        got = mgr.get(s.id)
        assert got.category == "new"
        assert got.name == "partial"
        assert got.tags == ["a"]

    def test_run_on_create_flag(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(
            name="auto", script="echo auto", run_on_create=True,
        ))
        assert s.run_on_create is True

    def test_env_vars(self):
        mgr = ProvisioningManager()
        s = mgr.create(ProvisioningScript(
            name="env-test", script="echo $FOO", env={"FOO": "bar"},
        ))
        assert s.env["FOO"] == "bar"

    def test_global_singleton(self):
        m1 = get_provisioning_manager()
        m2 = get_provisioning_manager()
        assert m1 is m2
