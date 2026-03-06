"""Tests for the extensions module."""

import pytest
from src.services.extensions import (
    Extension,
    ExtensionRegistry,
    get_extension_registry,
    reset_extension_registry,
    BUILT_IN_EXTENSIONS,
)


@pytest.fixture(autouse=True)
def _reset():
    reset_extension_registry()
    yield
    reset_extension_registry()


class TestExtensionRegistry:
    def test_builtin_extensions_loaded(self):
        registry = ExtensionRegistry()
        assert len(registry.list_all()) == len(BUILT_IN_EXTENSIONS)
        assert len(registry.list_all()) >= 10

    def test_get_extension(self):
        registry = ExtensionRegistry()
        ext = registry.get("git")
        assert ext is not None
        assert ext.name == "Git"
        assert "git" in ext.packages

    def test_get_nonexistent(self):
        registry = ExtensionRegistry()
        assert registry.get("nonexistent") is None

    def test_list_by_category(self):
        registry = ExtensionRegistry()
        db_exts = registry.list_by_category("database")
        assert len(db_exts) >= 3
        assert all(e.category == "database" for e in db_exts)

    def test_search(self):
        registry = ExtensionRegistry()
        results = registry.search("docker")
        assert any(e.id == "docker" for e in results)

    def test_search_by_tag(self):
        registry = ExtensionRegistry()
        results = registry.search("sql")
        assert len(results) >= 2

    def test_get_categories(self):
        registry = ExtensionRegistry()
        cats = registry.get_categories()
        assert "database" in cats
        assert "developer-tools" in cats

    def test_get_setup_script(self):
        registry = ExtensionRegistry()
        script = registry.get_setup_script(["git", "redis"])
        assert "#!/bin/bash" in script
        assert "git" in script
        assert "redis" in script

    def test_get_combined_env(self):
        registry = ExtensionRegistry()
        env = registry.get_combined_env(["postgresql", "redis"])
        assert "DATABASE_URL" in env
        assert "REDIS_URL" in env

    def test_get_combined_ports(self):
        registry = ExtensionRegistry()
        ports = registry.get_combined_ports(["postgresql", "redis"])
        assert 5432 in ports
        assert 6379 in ports

    def test_register_custom(self):
        registry = ExtensionRegistry()
        custom = Extension(
            id="custom-tool",
            name="Custom Tool",
            description="A custom extension",
            category="custom",
        )
        registry.register(custom)
        assert registry.get("custom-tool") is not None

    def test_global_singleton(self):
        r1 = get_extension_registry()
        r2 = get_extension_registry()
        assert r1 is r2

    def test_all_builtins_have_required_fields(self):
        for ext in BUILT_IN_EXTENSIONS:
            assert ext.id, "Extension missing id"
            assert ext.name, f"{ext.id} missing name"
            assert ext.description, f"{ext.id} missing description"
            assert ext.category, f"{ext.id} missing category"

    def test_vnc_desktop_extension(self):
        registry = ExtensionRegistry()
        ext = registry.get("vnc-desktop")
        assert ext is not None
        assert 6080 in ext.ports
        assert "DISPLAY" in ext.env

    def test_docker_extension(self):
        registry = ExtensionRegistry()
        ext = registry.get("docker")
        assert ext is not None
        assert "DOCKER_HOST" in ext.env

    def test_powerbi_extension(self):
        registry = ExtensionRegistry()
        ext = registry.get("powerbi")
        assert ext is not None
        assert 8501 in ext.ports

    def test_setup_script_unknown_extension(self):
        registry = ExtensionRegistry()
        script = registry.get_setup_script(["nonexistent"])
        assert "#!/bin/bash" in script
