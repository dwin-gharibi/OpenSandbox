"""
Cost tracking service for OpenSandbox.

Tracks resource consumption per sandbox and per API key for billing
and resource planning purposes.
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

from src.services.event_bus import EventBus, EventType, SandboxEvent, get_event_bus

logger = logging.getLogger(__name__)


@dataclass
class CostRecord:
    id: str = field(default_factory=lambda: uuid4().hex)
    sandbox_id: str = ""
    api_key: str = ""
    resource_type: str = ""
    quantity: float = 0.0
    unit: str = ""
    unit_cost: float = 0.0
    total_cost: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


class CostTracker:
    """Thread-safe cost tracker backed by SQLite."""

    DEFAULT_RATES = {
        "cpu_seconds": 0.00001,
        "memory_mb_seconds": 0.000001,
        "sandbox_hours": 0.01,
        "snapshot": 0.005,
        "clone": 0.005,
    }

    def __init__(self, db_path: str = ":memory:") -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._rates = dict(self.DEFAULT_RATES)
        self._init_db()

    def _init_db(self) -> None:
        with self._lock:
            self._conn.execute("""
                CREATE TABLE IF NOT EXISTS cost_records (
                    id TEXT PRIMARY KEY,
                    sandbox_id TEXT NOT NULL DEFAULT '',
                    api_key TEXT NOT NULL DEFAULT '',
                    resource_type TEXT NOT NULL,
                    quantity REAL NOT NULL DEFAULT 0,
                    unit TEXT NOT NULL DEFAULT '',
                    unit_cost REAL NOT NULL DEFAULT 0,
                    total_cost REAL NOT NULL DEFAULT 0,
                    timestamp TEXT NOT NULL,
                    metadata TEXT NOT NULL DEFAULT '{}'
                )
            """)
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cost_sandbox ON cost_records(sandbox_id)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cost_apikey ON cost_records(api_key)"
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cost_ts ON cost_records(timestamp)"
            )
            self._conn.commit()

    def set_rate(self, resource_type: str, rate: float) -> None:
        self._rates[resource_type] = rate

    def record(self, rec: CostRecord) -> None:
        with self._lock:
            self._conn.execute(
                """INSERT INTO cost_records
                   (id, sandbox_id, api_key, resource_type, quantity, unit, unit_cost, total_cost, timestamp, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    rec.id, rec.sandbox_id, rec.api_key, rec.resource_type,
                    rec.quantity, rec.unit, rec.unit_cost, rec.total_cost,
                    rec.timestamp, json.dumps(rec.metadata),
                ),
            )
            self._conn.commit()

    def record_sandbox_usage(
        self, sandbox_id: str, api_key: str, hours: float, cpu_seconds: float = 0, memory_mb_seconds: float = 0
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        records = []
        if hours > 0:
            rate = self._rates.get("sandbox_hours", 0.01)
            records.append(CostRecord(
                sandbox_id=sandbox_id, api_key=api_key, resource_type="sandbox_hours",
                quantity=hours, unit="hours", unit_cost=rate,
                total_cost=round(hours * rate, 6), timestamp=now,
            ))
        if cpu_seconds > 0:
            rate = self._rates.get("cpu_seconds", 0.00001)
            records.append(CostRecord(
                sandbox_id=sandbox_id, api_key=api_key, resource_type="cpu_seconds",
                quantity=cpu_seconds, unit="seconds", unit_cost=rate,
                total_cost=round(cpu_seconds * rate, 6), timestamp=now,
            ))
        if memory_mb_seconds > 0:
            rate = self._rates.get("memory_mb_seconds", 0.000001)
            records.append(CostRecord(
                sandbox_id=sandbox_id, api_key=api_key, resource_type="memory_mb_seconds",
                quantity=memory_mb_seconds, unit="mb_seconds", unit_cost=rate,
                total_cost=round(memory_mb_seconds * rate, 6), timestamp=now,
            ))
        for r in records:
            self.record(r)

    def get_sandbox_cost(self, sandbox_id: str) -> Dict[str, Any]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT resource_type, SUM(total_cost) as total FROM cost_records WHERE sandbox_id = ? GROUP BY resource_type",
                (sandbox_id,),
            ).fetchall()
            total_row = self._conn.execute(
                "SELECT SUM(total_cost) as grand_total FROM cost_records WHERE sandbox_id = ?",
                (sandbox_id,),
            ).fetchone()
        breakdown = {row["resource_type"]: row["total"] for row in rows}
        return {
            "sandbox_id": sandbox_id,
            "total_cost": round(total_row["grand_total"] or 0, 6) if total_row else 0,
            "breakdown": breakdown,
        }

    def get_api_key_cost(self, api_key: str, since: Optional[str] = None) -> Dict[str, Any]:
        params: List[Any] = [api_key]
        where = "api_key = ?"
        if since:
            where += " AND timestamp >= ?"
            params.append(since)
        with self._lock:
            total_row = self._conn.execute(
                f"SELECT SUM(total_cost) as grand_total FROM cost_records WHERE {where}", params
            ).fetchone()
            rows = self._conn.execute(
                f"SELECT resource_type, SUM(total_cost) as total FROM cost_records WHERE {where} GROUP BY resource_type",
                params,
            ).fetchall()
        breakdown = {row["resource_type"]: row["total"] for row in rows}
        return {
            "api_key": api_key[:8] + "***",
            "total_cost": round(total_row["grand_total"] or 0, 6) if total_row else 0,
            "breakdown": breakdown,
        }

    def get_summary(self, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, Any]:
        clauses: List[str] = []
        params: List[Any] = []
        if since:
            clauses.append("timestamp >= ?")
            params.append(since)
        if until:
            clauses.append("timestamp <= ?")
            params.append(until)
        where = " AND ".join(clauses) if clauses else "1=1"

        with self._lock:
            total_row = self._conn.execute(
                f"SELECT SUM(total_cost) as total, COUNT(DISTINCT sandbox_id) as sandbox_count FROM cost_records WHERE {where}",
                params,
            ).fetchone()
        return {
            "total_cost": round(total_row["total"] or 0, 6) if total_row else 0,
            "sandbox_count": total_row["sandbox_count"] if total_row else 0,
        }

    def close(self) -> None:
        self._conn.close()


_global_tracker: Optional[CostTracker] = None


def get_cost_tracker() -> CostTracker:
    global _global_tracker
    if _global_tracker is None:
        _global_tracker = CostTracker()
    return _global_tracker


def reset_cost_tracker() -> None:
    global _global_tracker
    if _global_tracker is not None:
        _global_tracker.close()
    _global_tracker = None


def setup_cost_event_listener(bus: Optional[EventBus] = None) -> None:
    event_bus = bus or get_event_bus()
    tracker = get_cost_tracker()

    def _on_event(event: SandboxEvent) -> None:
        if event.event_type == EventType.SANDBOX_CREATED:
            tracker.record(CostRecord(
                sandbox_id=event.sandbox_id, api_key=event.actor,
                resource_type="sandbox_hours", quantity=0, unit="hours",
                unit_cost=tracker._rates.get("sandbox_hours", 0.01), total_cost=0,
            ))
        elif event.event_type == EventType.SANDBOX_SNAPSHOT_CREATED:
            rate = tracker._rates.get("snapshot", 0.005)
            tracker.record(CostRecord(
                sandbox_id=event.sandbox_id, api_key=event.actor,
                resource_type="snapshot", quantity=1, unit="count",
                unit_cost=rate, total_cost=rate,
            ))
        elif event.event_type == EventType.SANDBOX_CLONED:
            rate = tracker._rates.get("clone", 0.005)
            tracker.record(CostRecord(
                sandbox_id=event.sandbox_id, api_key=event.actor,
                resource_type="clone", quantity=1, unit="count",
                unit_cost=rate, total_cost=rate,
            ))

    event_bus.subscribe(None, _on_event)
