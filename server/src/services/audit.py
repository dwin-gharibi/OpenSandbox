"""
Audit logging service for OpenSandbox.

Records all sandbox operations with actor, action, resource, and outcome
for compliance, debugging, and security analysis.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from src.services.event_bus import EventBus, SandboxEvent, get_event_bus

logger = logging.getLogger(__name__)


@dataclass
class AuditEntry:
    id: str = field(default_factory=lambda: uuid4().hex)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    actor: str = ""
    action: str = ""
    resource_type: str = "sandbox"
    resource_id: str = ""
    outcome: str = "success"
    details: Dict[str, Any] = field(default_factory=dict)
    ip_address: str = ""
    request_id: str = ""


class AuditLog:
    """Thread-safe audit log backed by SQLite."""

    def __init__(self, db_path: str = ":memory:") -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self) -> None:
        with self._lock:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT '',
                    action TEXT NOT NULL,
                    resource_type TEXT NOT NULL DEFAULT 'sandbox',
                    resource_id TEXT NOT NULL DEFAULT '',
                    outcome TEXT NOT NULL DEFAULT 'success',
                    details TEXT NOT NULL DEFAULT '{}',
                    ip_address TEXT NOT NULL DEFAULT '',
                    request_id TEXT NOT NULL DEFAULT ''
                )
            """)
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor)"
            )
            self._conn.commit()

    def record(self, entry: AuditEntry) -> None:
        with self._lock:
            self._conn.execute(
                """INSERT INTO audit_log (id, timestamp, actor, action, resource_type,
                   resource_id, outcome, details, ip_address, request_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    entry.id,
                    entry.timestamp,
                    entry.actor,
                    entry.action,
                    entry.resource_type,
                    entry.resource_id,
                    entry.outcome,
                    json.dumps(entry.details),
                    entry.ip_address,
                    entry.request_id,
                ),
            )
            self._conn.commit()

    def query(
        self,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        resource_id: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        clauses: List[str] = []
        params: List[Any] = []
        if actor:
            clauses.append("actor = ?")
            params.append(actor)
        if action:
            clauses.append("action = ?")
            params.append(action)
        if resource_id:
            clauses.append("resource_id = ?")
            params.append(resource_id)
        if since:
            clauses.append("timestamp >= ?")
            params.append(since)
        if until:
            clauses.append("timestamp <= ?")
            params.append(until)

        where = " AND ".join(clauses) if clauses else "1=1"
        params.extend([limit, offset])

        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM audit_log WHERE {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                params,
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def count(
        self,
        actor: Optional[str] = None,
        action: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> int:
        clauses: List[str] = []
        params: List[Any] = []
        if actor:
            clauses.append("actor = ?")
            params.append(actor)
        if action:
            clauses.append("action = ?")
            params.append(action)
        if resource_id:
            clauses.append("resource_id = ?")
            params.append(resource_id)

        where = " AND ".join(clauses) if clauses else "1=1"
        with self._lock:
            row = self._conn.execute(
                f"SELECT COUNT(*) FROM audit_log WHERE {where}", params
            ).fetchone()
        return row[0] if row else 0

    @staticmethod
    def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
        d = dict(row)
        if isinstance(d.get("details"), str):
            d["details"] = json.loads(d["details"])
        return d

    def close(self) -> None:
        self._conn.close()


_global_audit: Optional[AuditLog] = None


def get_audit_log() -> AuditLog:
    global _global_audit
    if _global_audit is None:
        _global_audit = AuditLog()
    return _global_audit


def reset_audit_log() -> None:
    global _global_audit
    if _global_audit is not None:
        _global_audit.close()
    _global_audit = None


def setup_audit_event_listener(bus: Optional[EventBus] = None) -> None:
    """Register event bus subscriber that writes audit entries."""
    event_bus = bus or get_event_bus()
    audit = get_audit_log()

    def _on_event(event: SandboxEvent) -> None:
        entry = AuditEntry(
            actor=event.actor,
            action=event.event_type.value,
            resource_id=event.sandbox_id,
            details=event.data,
        )
        audit.record(entry)

    event_bus.subscribe(None, _on_event)
