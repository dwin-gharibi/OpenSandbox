"""
Sandbox snapshot and cloning service.

Provides the ability to checkpoint a running sandbox (Docker commit)
and clone it into a new sandbox instance.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from src.services.event_bus import EventType, SandboxEvent, get_event_bus

logger = logging.getLogger(__name__)


@dataclass
class Snapshot:
    id: str = field(default_factory=lambda: uuid4().hex)
    sandbox_id: str = ""
    image_tag: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    size_bytes: int = 0
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class SnapshotManager:
    """Manages sandbox snapshots (checkpoints) using Docker commit."""

    def __init__(self) -> None:
        self._snapshots: Dict[str, Snapshot] = {}
        self._lock = threading.Lock()

    def create_snapshot(
        self,
        sandbox_id: str,
        container_id: str,
        description: str = "",
        docker_client: Any = None,
        actor: str = "",
    ) -> Snapshot:
        snapshot_id = uuid4().hex
        tag = f"opensandbox/snapshot:{sandbox_id[:12]}-{snapshot_id[:8]}"

        if docker_client is not None:
            try:
                container = docker_client.containers.get(container_id)
                container.commit(repository="opensandbox/snapshot", tag=f"{sandbox_id[:12]}-{snapshot_id[:8]}")
                inspect = docker_client.images.get(tag)
                size = getattr(inspect, "attrs", {}).get("Size", 0)
            except Exception:
                logger.exception("Docker commit failed for %s", sandbox_id)
                size = 0
        else:
            size = 0

        snapshot = Snapshot(
            id=snapshot_id,
            sandbox_id=sandbox_id,
            image_tag=tag,
            size_bytes=size,
            description=description,
        )

        with self._lock:
            self._snapshots[snapshot_id] = snapshot

        bus = get_event_bus()
        bus.publish(SandboxEvent(
            event_type=EventType.SANDBOX_SNAPSHOT_CREATED,
            sandbox_id=sandbox_id,
            actor=actor,
            data={"snapshot_id": snapshot_id, "image_tag": tag},
        ))

        return snapshot

    def get_snapshot(self, snapshot_id: str) -> Optional[Snapshot]:
        with self._lock:
            return self._snapshots.get(snapshot_id)

    def list_snapshots(self, sandbox_id: Optional[str] = None) -> List[Snapshot]:
        with self._lock:
            snapshots = list(self._snapshots.values())
        if sandbox_id:
            snapshots = [s for s in snapshots if s.sandbox_id == sandbox_id]
        return sorted(snapshots, key=lambda s: s.created_at, reverse=True)

    def delete_snapshot(self, snapshot_id: str, docker_client: Any = None) -> bool:
        with self._lock:
            snapshot = self._snapshots.pop(snapshot_id, None)
        if snapshot is None:
            return False
        if docker_client is not None:
            try:
                docker_client.images.remove(snapshot.image_tag, force=True)
            except Exception:
                logger.warning("Failed to remove snapshot image %s", snapshot.image_tag)
        return True


_global_snapshot_mgr: Optional[SnapshotManager] = None


def get_snapshot_manager() -> SnapshotManager:
    global _global_snapshot_mgr
    if _global_snapshot_mgr is None:
        _global_snapshot_mgr = SnapshotManager()
    return _global_snapshot_mgr


def reset_snapshot_manager() -> None:
    global _global_snapshot_mgr
    _global_snapshot_mgr = None
