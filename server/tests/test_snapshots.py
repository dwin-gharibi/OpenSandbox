"""Tests for the snapshot and cloning module."""

import pytest
from src.services.snapshots import SnapshotManager, get_snapshot_manager, reset_snapshot_manager
from src.services.event_bus import reset_event_bus


@pytest.fixture(autouse=True)
def _reset():
    reset_snapshot_manager()
    reset_event_bus()
    yield
    reset_snapshot_manager()
    reset_event_bus()


class TestSnapshotManager:
    def test_create_snapshot(self):
        mgr = SnapshotManager()
        snapshot = mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1", description="test snapshot")
        assert snapshot.sandbox_id == "sb-1"
        assert snapshot.description == "test snapshot"
        assert snapshot.id
        assert snapshot.image_tag.startswith("opensandbox/snapshot:")

    def test_get_snapshot(self):
        mgr = SnapshotManager()
        snapshot = mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        result = mgr.get_snapshot(snapshot.id)
        assert result is not None
        assert result.id == snapshot.id

    def test_get_nonexistent_snapshot(self):
        mgr = SnapshotManager()
        assert mgr.get_snapshot("nonexistent") is None

    def test_list_snapshots(self):
        mgr = SnapshotManager()
        mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        mgr.create_snapshot(sandbox_id="sb-2", container_id="c-2")
        all_snaps = mgr.list_snapshots()
        assert len(all_snaps) == 3
        sb1_snaps = mgr.list_snapshots(sandbox_id="sb-1")
        assert len(sb1_snaps) == 2

    def test_delete_snapshot(self):
        mgr = SnapshotManager()
        snapshot = mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        assert mgr.delete_snapshot(snapshot.id) is True
        assert mgr.get_snapshot(snapshot.id) is None

    def test_delete_nonexistent_snapshot(self):
        mgr = SnapshotManager()
        assert mgr.delete_snapshot("nonexistent") is False

    def test_snapshots_sorted_by_time(self):
        mgr = SnapshotManager()
        mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        s2 = mgr.create_snapshot(sandbox_id="sb-1", container_id="c-1")
        snaps = mgr.list_snapshots()
        assert snaps[0].id == s2.id

    def test_global_singleton(self):
        m1 = get_snapshot_manager()
        m2 = get_snapshot_manager()
        assert m1 is m2
