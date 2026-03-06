"""
Provisioning scripts service for OpenSandbox.

Stores reusable shell scripts that can be attached to sandboxes at creation
time or applied on-demand. Scripts run inside sandboxes via the execd command API.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class ProvisioningScript:
    id: str = field(default_factory=lambda: uuid4().hex)
    name: str = ""
    description: str = ""
    script: str = ""
    language: str = "bash"
    category: str = "general"
    tags: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    timeout_seconds: int = 120
    run_on_create: bool = False
    created_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProvisioningManager:
    """Manages reusable provisioning scripts for sandboxes."""

    def __init__(self) -> None:
        self._scripts: Dict[str, ProvisioningScript] = {}
        self._lock = threading.Lock()
        self._load_defaults()

    def _load_defaults(self) -> None:
        defaults = [
            ProvisioningScript(
                name="Python Dev Setup",
                description="Install common Python development tools: pip, venv, black, ruff, pytest",
                script="#!/bin/bash\nset -e\npip install --upgrade pip\npip install black ruff pytest ipython\necho 'Python dev tools installed'",
                category="development",
                tags=["python", "dev"],
            ),
            ProvisioningScript(
                name="Node.js Project Init",
                description="Initialize a Node.js project with TypeScript and common dependencies",
                script="#!/bin/bash\nset -e\nmkdir -p /workspace/app && cd /workspace/app\nnpm init -y\nnpm install typescript @types/node ts-node\nnpx tsc --init\necho 'Node.js project initialized at /workspace/app'",
                category="development",
                tags=["nodejs", "typescript"],
            ),
            ProvisioningScript(
                name="Security Hardening",
                description="Apply basic security hardening: update packages, remove unnecessary tools",
                script="#!/bin/bash\nset -e\napt-get update -qq && apt-get upgrade -y -qq\napt-get autoremove -y -qq\necho 'Security updates applied'",
                category="security",
                tags=["security", "hardening"],
            ),
            ProvisioningScript(
                name="Data Science Workspace",
                description="Set up Jupyter, pandas, numpy, matplotlib, scikit-learn",
                script="#!/bin/bash\nset -e\npip install jupyter pandas numpy matplotlib scikit-learn seaborn\nmkdir -p /workspace/notebooks\necho 'Data science workspace ready at /workspace/notebooks'",
                category="data-science",
                tags=["python", "data-science", "jupyter"],
            ),
            ProvisioningScript(
                name="Web Server (Nginx + Node)",
                description="Set up Nginx reverse proxy with Node.js backend",
                script="#!/bin/bash\nset -e\napt-get update -qq && apt-get install -y -qq nginx\nmkdir -p /workspace/web\necho 'server { listen 80; location / { proxy_pass http://localhost:3000; } }' > /etc/nginx/sites-available/default\nnginx\necho 'Nginx configured, proxying port 80 -> 3000'",
                category="web",
                tags=["nginx", "web", "proxy"],
            ),
            ProvisioningScript(
                name="Git Repository Clone",
                description="Clone a git repository into /workspace/repo (set GIT_REPO_URL env var)",
                script='#!/bin/bash\nset -e\nif [ -z "$GIT_REPO_URL" ]; then\n  echo "Error: Set GIT_REPO_URL environment variable"\n  exit 1\nfi\napt-get update -qq && apt-get install -y -qq git\ngit clone "$GIT_REPO_URL" /workspace/repo\necho "Cloned $GIT_REPO_URL to /workspace/repo"',
                category="development",
                tags=["git", "clone"],
                env={"GIT_REPO_URL": ""},
            ),
        ]
        for d in defaults:
            self._scripts[d.id] = d

    def create(self, script: ProvisioningScript) -> ProvisioningScript:
        with self._lock:
            self._scripts[script.id] = script
        return script

    def get(self, script_id: str) -> Optional[ProvisioningScript]:
        with self._lock:
            return self._scripts.get(script_id)

    def list_all(self, category: Optional[str] = None, tag: Optional[str] = None) -> List[ProvisioningScript]:
        with self._lock:
            scripts = list(self._scripts.values())
        if category:
            scripts = [s for s in scripts if s.category == category]
        if tag:
            scripts = [s for s in scripts if tag in s.tags]
        return sorted(scripts, key=lambda s: s.updated_at, reverse=True)

    def update(
        self,
        script_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        script: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        env: Optional[Dict[str, str]] = None,
        timeout_seconds: Optional[int] = None,
        run_on_create: Optional[bool] = None,
    ) -> Optional[ProvisioningScript]:
        with self._lock:
            s = self._scripts.get(script_id)
            if s is None:
                return None
            if name is not None:
                s.name = name
            if description is not None:
                s.description = description
            if script is not None:
                s.script = script
            if category is not None:
                s.category = category
            if tags is not None:
                s.tags = tags
            if env is not None:
                s.env = env
            if timeout_seconds is not None:
                s.timeout_seconds = timeout_seconds
            if run_on_create is not None:
                s.run_on_create = run_on_create
            s.updated_at = datetime.now(timezone.utc).isoformat()
            return s

    def delete(self, script_id: str) -> bool:
        with self._lock:
            return self._scripts.pop(script_id, None) is not None

    def get_categories(self) -> List[str]:
        with self._lock:
            return sorted(set(s.category for s in self._scripts.values()))

    def search(self, query: str) -> List[ProvisioningScript]:
        q = query.lower()
        with self._lock:
            return [
                s for s in self._scripts.values()
                if q in s.name.lower() or q in s.description.lower() or any(q in t for t in s.tags)
            ]


_global_mgr: Optional[ProvisioningManager] = None


def get_provisioning_manager() -> ProvisioningManager:
    global _global_mgr
    if _global_mgr is None:
        _global_mgr = ProvisioningManager()
    return _global_mgr


def reset_provisioning_manager() -> None:
    global _global_mgr
    _global_mgr = None
