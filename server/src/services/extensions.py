"""
Sandbox extensions system for OpenSandbox.

Provides pre-built extension configurations that can be applied to sandboxes
for common tools: git, SQL databases, Docker-in-Docker, data visualization, etc.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class Extension:
    id: str
    name: str
    description: str
    category: str
    icon: str = ""
    env: Dict[str, str] = field(default_factory=dict)
    packages: List[str] = field(default_factory=list)
    setup_commands: List[str] = field(default_factory=list)
    ports: List[int] = field(default_factory=list)
    resource_hints: Dict[str, str] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)


BUILT_IN_EXTENSIONS: List[Extension] = [
    Extension(
        id="git",
        name="Git",
        description="Git version control with credential helpers and common configuration",
        category="developer-tools",
        icon="git-branch",
        packages=["git", "git-lfs"],
        setup_commands=[
            "git config --global init.defaultBranch main",
            "git config --global core.autocrlf input",
        ],
        tags=["vcs", "developer"],
    ),
    Extension(
        id="docker",
        name="Docker-in-Docker",
        description="Run Docker containers inside the sandbox (requires privileged mode)",
        category="container",
        icon="container",
        packages=["docker.io", "docker-compose-v2"],
        setup_commands=["dockerd &>/dev/null &", "sleep 2"],
        env={"DOCKER_HOST": "unix:///var/run/docker.sock"},
        resource_hints={"cpu": "1000m", "memory": "2Gi"},
        tags=["container", "devops"],
    ),
    Extension(
        id="postgresql",
        name="PostgreSQL",
        description="PostgreSQL database server with psql client",
        category="database",
        icon="database",
        packages=["postgresql", "postgresql-client"],
        setup_commands=[
            "pg_ctlcluster 16 main start || pg_ctlcluster 14 main start || true",
            "su - postgres -c \"psql -c \\\"CREATE USER sandbox WITH PASSWORD 'sandbox' SUPERUSER;\\\" 2>/dev/null || true\"",
            "su - postgres -c \"createdb sandbox -O sandbox 2>/dev/null || true\"",
        ],
        env={"DATABASE_URL": "postgresql://sandbox:sandbox@localhost:5432/sandbox", "PGPASSWORD": "sandbox"},
        ports=[5432],
        tags=["database", "sql"],
    ),
    Extension(
        id="mysql",
        name="MySQL",
        description="MySQL database server with client tools",
        category="database",
        icon="database",
        packages=["mysql-server", "mysql-client"],
        setup_commands=[
            "mysqld --user=root --datadir=/var/lib/mysql &>/dev/null &",
            "sleep 3",
            "mysql -u root -e \"CREATE DATABASE IF NOT EXISTS sandbox; CREATE USER IF NOT EXISTS 'sandbox'@'localhost' IDENTIFIED BY 'sandbox'; GRANT ALL ON sandbox.* TO 'sandbox'@'localhost'; FLUSH PRIVILEGES;\" 2>/dev/null || true",
        ],
        env={"DATABASE_URL": "mysql://sandbox:sandbox@localhost:3306/sandbox"},
        ports=[3306],
        tags=["database", "sql"],
    ),
    Extension(
        id="redis",
        name="Redis",
        description="Redis in-memory data store",
        category="database",
        icon="database",
        packages=["redis-server", "redis-tools"],
        setup_commands=["redis-server --daemonize yes"],
        env={"REDIS_URL": "redis://localhost:6379"},
        ports=[6379],
        tags=["database", "cache"],
    ),
    Extension(
        id="sqlite",
        name="SQLite",
        description="SQLite database with CLI tools",
        category="database",
        icon="database",
        packages=["sqlite3", "libsqlite3-dev"],
        env={"SQLITE_DB": "/workspace/data.db"},
        tags=["database", "sql"],
    ),
    Extension(
        id="nodejs",
        name="Node.js Development",
        description="Node.js runtime with npm, yarn, and common tools",
        category="runtime",
        icon="code",
        packages=["nodejs", "npm"],
        setup_commands=["npm install -g yarn pnpm typescript ts-node 2>/dev/null || true"],
        tags=["runtime", "javascript"],
    ),
    Extension(
        id="python-ds",
        name="Python Data Science",
        description="NumPy, Pandas, Matplotlib, Scikit-learn, Jupyter",
        category="data-science",
        icon="bar-chart",
        packages=["python3-pip"],
        setup_commands=[
            "pip install numpy pandas matplotlib scikit-learn seaborn jupyter ipykernel 2>/dev/null || true",
        ],
        resource_hints={"cpu": "1000m", "memory": "2Gi"},
        tags=["data-science", "python", "ml"],
    ),
    Extension(
        id="powerbi",
        name="Power BI / Data Visualization",
        description="Data visualization tools with Plotly, Dash, and Streamlit",
        category="data-science",
        icon="bar-chart-2",
        packages=["python3-pip"],
        setup_commands=[
            "pip install plotly dash streamlit bokeh altair 2>/dev/null || true",
        ],
        ports=[8501, 8050],
        tags=["visualization", "dashboard", "bi"],
    ),
    Extension(
        id="vnc-desktop",
        name="VNC Desktop",
        description="Full desktop environment accessible via VNC (noVNC web client)",
        category="desktop",
        icon="monitor",
        packages=["xvfb", "x11vnc", "xfce4", "xfce4-terminal", "novnc", "websockify"],
        setup_commands=[
            "Xvfb :99 -screen 0 1280x1024x24 &",
            "export DISPLAY=:99",
            "startxfce4 &>/dev/null &",
            "x11vnc -display :99 -forever -nopw -shared -rfbport 5900 &>/dev/null &",
            "websockify --web=/usr/share/novnc 6080 localhost:5900 &>/dev/null &",
        ],
        env={"DISPLAY": ":99", "VNC_PORT": "5900", "NOVNC_PORT": "6080"},
        ports=[5900, 6080],
        resource_hints={"cpu": "1000m", "memory": "1Gi"},
        tags=["desktop", "vnc", "gui"],
    ),
    Extension(
        id="chrome",
        name="Chrome Browser",
        description="Headless Chrome with Puppeteer/Playwright support",
        category="browser",
        icon="globe",
        packages=["chromium-browser", "chromium-chromedriver"],
        env={"CHROME_BIN": "/usr/bin/chromium-browser", "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "true"},
        resource_hints={"cpu": "1000m", "memory": "1Gi"},
        tags=["browser", "testing", "automation"],
    ),
    Extension(
        id="ssh",
        name="SSH Server",
        description="OpenSSH server for remote access",
        category="developer-tools",
        icon="terminal",
        packages=["openssh-server"],
        setup_commands=[
            "mkdir -p /run/sshd",
            "echo 'root:sandbox' | chpasswd",
            "sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config",
            "/usr/sbin/sshd",
        ],
        ports=[22],
        tags=["remote-access", "ssh"],
    ),
    Extension(
        id="nginx",
        name="Nginx Web Server",
        description="Nginx HTTP server for serving web applications",
        category="web",
        icon="globe",
        packages=["nginx"],
        setup_commands=["nginx"],
        ports=[80],
        tags=["web", "server"],
    ),
    Extension(
        id="jupyter",
        name="Jupyter Lab",
        description="Full JupyterLab environment for interactive computing",
        category="data-science",
        icon="book-open",
        packages=["python3-pip"],
        setup_commands=[
            "pip install jupyterlab 2>/dev/null || true",
            "jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --NotebookApp.token='' &>/dev/null &",
        ],
        ports=[8888],
        tags=["notebook", "data-science", "python"],
    ),
    Extension(
        id="vscode-server",
        name="VS Code Server",
        description="Code-server (VS Code in browser)",
        category="developer-tools",
        icon="code",
        setup_commands=[
            "curl -fsSL https://code-server.dev/install.sh | sh 2>/dev/null || true",
            "code-server --bind-addr 0.0.0.0:8443 --auth none &>/dev/null &",
        ],
        ports=[8443],
        resource_hints={"cpu": "1000m", "memory": "1Gi"},
        tags=["ide", "editor", "developer"],
    ),
]


class ExtensionRegistry:
    """Registry of available sandbox extensions."""

    def __init__(self) -> None:
        self._extensions: Dict[str, Extension] = {}
        for ext in BUILT_IN_EXTENSIONS:
            self._extensions[ext.id] = ext

    def get(self, ext_id: str) -> Optional[Extension]:
        return self._extensions.get(ext_id)

    def list_all(self) -> List[Extension]:
        return list(self._extensions.values())

    def list_by_category(self, category: str) -> List[Extension]:
        return [e for e in self._extensions.values() if e.category == category]

    def search(self, query: str) -> List[Extension]:
        q = query.lower()
        return [
            e for e in self._extensions.values()
            if q in e.name.lower() or q in e.description.lower()
            or any(q in t for t in e.tags)
        ]

    def get_categories(self) -> List[str]:
        return sorted(set(e.category for e in self._extensions.values()))

    def register(self, extension: Extension) -> None:
        self._extensions[extension.id] = extension

    def get_setup_script(self, ext_ids: List[str]) -> str:
        """Generate a combined setup script for multiple extensions."""
        lines = ["#!/bin/bash", "set -e", ""]
        for ext_id in ext_ids:
            ext = self._extensions.get(ext_id)
            if ext is None:
                continue
            lines.append(f"# --- {ext.name} ---")
            if ext.packages:
                lines.append(f"apt-get update -qq && apt-get install -y -qq {' '.join(ext.packages)} 2>/dev/null || true")
            for cmd in ext.setup_commands:
                lines.append(cmd)
            lines.append("")
        return "\n".join(lines)

    def get_combined_env(self, ext_ids: List[str]) -> Dict[str, str]:
        env: Dict[str, str] = {}
        for ext_id in ext_ids:
            ext = self._extensions.get(ext_id)
            if ext:
                env.update(ext.env)
        return env

    def get_combined_ports(self, ext_ids: List[str]) -> List[int]:
        ports: List[int] = []
        for ext_id in ext_ids:
            ext = self._extensions.get(ext_id)
            if ext:
                ports.extend(ext.ports)
        return sorted(set(ports))


_global_registry: Optional[ExtensionRegistry] = None


def get_extension_registry() -> ExtensionRegistry:
    global _global_registry
    if _global_registry is None:
        _global_registry = ExtensionRegistry()
    return _global_registry


def reset_extension_registry() -> None:
    global _global_registry
    _global_registry = None
