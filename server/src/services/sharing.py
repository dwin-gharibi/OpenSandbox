"""
Sandbox sharing and collaboration service.

Allows sandbox access to be shared with multiple users via
share tokens with configurable permissions and expiration.
"""

from __future__ import annotations

import logging
import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional
from uuid import uuid4

from src.services.event_bus import EventType, SandboxEvent, get_event_bus

logger = logging.getLogger(__name__)

Permission = Literal["read", "write", "admin"]


@dataclass
class ShareToken:
    id: str = field(default_factory=lambda: uuid4().hex)
    sandbox_id: str = ""
    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    permissions: List[Permission] = field(default_factory=lambda: ["read"])
    created_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None
    label: str = ""
    max_uses: Optional[int] = None
    use_count: int = 0


class SharingManager:
    """Manages sandbox sharing via tokens."""

    def __init__(self) -> None:
        self._tokens: Dict[str, ShareToken] = {}
        self._sandbox_tokens: Dict[str, List[str]] = {}
        self._lock = threading.Lock()

    def create_share(
        self,
        sandbox_id: str,
        permissions: List[Permission],
        created_by: str = "",
        label: str = "",
        expires_in_hours: Optional[int] = None,
        max_uses: Optional[int] = None,
    ) -> ShareToken:
        expires_at = None
        if expires_in_hours is not None:
            expires_at = (
                datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
            ).isoformat()

        share = ShareToken(
            sandbox_id=sandbox_id,
            permissions=permissions,
            created_by=created_by,
            expires_at=expires_at,
            label=label,
            max_uses=max_uses,
        )

        with self._lock:
            self._tokens[share.id] = share
            self._sandbox_tokens.setdefault(sandbox_id, []).append(share.id)

        bus = get_event_bus()
        bus.publish(
            SandboxEvent(
                event_type=EventType.SANDBOX_SHARED,
                sandbox_id=sandbox_id,
                actor=created_by,
                data={"share_id": share.id, "permissions": permissions},
            )
        )

        return share

    def validate_token(self, token: str) -> Optional[ShareToken]:
        with self._lock:
            for share in self._tokens.values():
                if share.token == token:
                    if share.expires_at:
                        exp = datetime.fromisoformat(share.expires_at)
                        if exp < datetime.now(timezone.utc):
                            return None
                    if share.max_uses is not None and share.use_count >= share.max_uses:
                        return None
                    share.use_count += 1
                    return share
        return None

    def list_shares(self, sandbox_id: str) -> List[ShareToken]:
        with self._lock:
            token_ids = self._sandbox_tokens.get(sandbox_id, [])
            return [self._tokens[tid] for tid in token_ids if tid in self._tokens]

    def revoke_share(self, share_id: str) -> bool:
        with self._lock:
            share = self._tokens.pop(share_id, None)
            if share is None:
                return False
            sandbox_ids = self._sandbox_tokens.get(share.sandbox_id, [])
            if share_id in sandbox_ids:
                sandbox_ids.remove(share_id)
            return True

    def revoke_all_shares(self, sandbox_id: str) -> int:
        with self._lock:
            token_ids = self._sandbox_tokens.pop(sandbox_id, [])
            count = 0
            for tid in token_ids:
                if self._tokens.pop(tid, None) is not None:
                    count += 1
            return count


_global_sharing: Optional[SharingManager] = None


def get_sharing_manager() -> SharingManager:
    global _global_sharing
    if _global_sharing is None:
        _global_sharing = SharingManager()
    return _global_sharing


def reset_sharing_manager() -> None:
    global _global_sharing
    _global_sharing = None
