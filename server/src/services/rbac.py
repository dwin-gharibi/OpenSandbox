"""
Role-Based Access Control (RBAC) for OpenSandbox.

Supports multiple API keys with different roles and permissions.
Roles: admin, user, viewer. Each role has a defined set of allowed actions.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional, Set
from uuid import uuid4

logger = logging.getLogger(__name__)

Role = Literal["admin", "user", "viewer"]

ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {
        "sandbox:create", "sandbox:read", "sandbox:delete", "sandbox:pause",
        "sandbox:resume", "sandbox:renew", "sandbox:snapshot", "sandbox:clone",
        "sandbox:share", "sandbox:proxy",
        "admin:keys", "admin:webhooks", "admin:audit", "admin:metrics",
        "admin:cost", "admin:health", "admin:config",
    },
    "user": {
        "sandbox:create", "sandbox:read", "sandbox:delete", "sandbox:pause",
        "sandbox:resume", "sandbox:renew", "sandbox:snapshot", "sandbox:clone",
        "sandbox:share", "sandbox:proxy",
    },
    "viewer": {
        "sandbox:read", "sandbox:proxy",
    },
}


@dataclass
class ApiKey:
    id: str = field(default_factory=lambda: uuid4().hex)
    key: str = field(default_factory=lambda: f"osk-{uuid4().hex}")
    name: str = ""
    role: Role = "user"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_used_at: Optional[str] = None
    is_active: bool = True
    rate_limit: Optional[int] = None
    sandbox_quota: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class RBACManager:
    """Manages API keys and role-based access control."""

    def __init__(self) -> None:
        self._keys: Dict[str, ApiKey] = {}
        self._key_lookup: Dict[str, str] = {}
        self._lock = threading.Lock()

    def create_key(
        self,
        name: str,
        role: Role = "user",
        rate_limit: Optional[int] = None,
        sandbox_quota: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> ApiKey:
        api_key = ApiKey(
            name=name,
            role=role,
            rate_limit=rate_limit,
            sandbox_quota=sandbox_quota,
            metadata=metadata or {},
        )
        with self._lock:
            self._keys[api_key.id] = api_key
            self._key_lookup[api_key.key] = api_key.id
        return api_key

    def validate_key(self, key_value: str) -> Optional[ApiKey]:
        with self._lock:
            key_id = self._key_lookup.get(key_value)
            if key_id is None:
                return None
            api_key = self._keys.get(key_id)
            if api_key is None or not api_key.is_active:
                return None
            api_key.last_used_at = datetime.now(timezone.utc).isoformat()
            return api_key

    def check_permission(self, key_value: str, permission: str) -> bool:
        api_key = self.validate_key(key_value)
        if api_key is None:
            return False
        allowed = ROLE_PERMISSIONS.get(api_key.role, set())
        return permission in allowed

    def get_key(self, key_id: str) -> Optional[ApiKey]:
        with self._lock:
            return self._keys.get(key_id)

    def list_keys(self) -> List[ApiKey]:
        with self._lock:
            return list(self._keys.values())

    def revoke_key(self, key_id: str) -> bool:
        with self._lock:
            api_key = self._keys.get(key_id)
            if api_key is None:
                return False
            api_key.is_active = False
            self._key_lookup.pop(api_key.key, None)
            return True

    def delete_key(self, key_id: str) -> bool:
        with self._lock:
            api_key = self._keys.pop(key_id, None)
            if api_key is None:
                return False
            self._key_lookup.pop(api_key.key, None)
            return True

    def update_key(
        self,
        key_id: str,
        name: Optional[str] = None,
        role: Optional[Role] = None,
        rate_limit: Optional[int] = None,
        sandbox_quota: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[ApiKey]:
        with self._lock:
            api_key = self._keys.get(key_id)
            if api_key is None:
                return None
            if name is not None:
                api_key.name = name
            if role is not None:
                api_key.role = role
            if rate_limit is not None:
                api_key.rate_limit = rate_limit
            if sandbox_quota is not None:
                api_key.sandbox_quota = sandbox_quota
            if is_active is not None:
                api_key.is_active = is_active
                if not is_active:
                    self._key_lookup.pop(api_key.key, None)
                else:
                    self._key_lookup[api_key.key] = api_key.id
            return api_key

    def load_from_config(self, api_key: Optional[str], role: Role = "admin") -> None:
        if api_key and api_key.strip():
            key_obj = ApiKey(
                key=api_key,
                name="config-default",
                role=role,
            )
            with self._lock:
                self._keys[key_obj.id] = key_obj
                self._key_lookup[key_obj.key] = key_obj.id


_global_rbac: Optional[RBACManager] = None


def get_rbac_manager() -> RBACManager:
    global _global_rbac
    if _global_rbac is None:
        _global_rbac = RBACManager()
    return _global_rbac


def reset_rbac_manager() -> None:
    global _global_rbac
    _global_rbac = None
