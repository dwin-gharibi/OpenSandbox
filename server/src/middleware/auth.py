"""
Authentication middleware for OpenSandbox Lifecycle API.

Pure ASGI middleware to avoid buffering streaming (SSE) responses.
API keys are configured via config.toml and validated against the
OPEN-SANDBOX-API-KEY header.
"""

import re
import json
from typing import Optional, Set

from starlette.types import ASGIApp, Receive, Scope, Send

from src.config import AppConfig, get_config


class AuthMiddleware:
    """
    ASGI middleware for API Key authentication.

    Validates the OPEN-SANDBOX-API-KEY header for all requests except
    health check, docs, and proxy paths.
    """

    API_KEY_HEADER = "open-sandbox-api-key"

    EXEMPT_PATHS = ["/health", "/docs", "/redoc", "/openapi.json", "/metrics/prometheus"]

    _PROXY_PATH_RE = re.compile(r"^(/v1)?/sandboxes/[^/]+/proxy/\d+(/|$)")

    def __init__(self, app: ASGIApp, config: Optional[AppConfig] = None) -> None:
        self.app = app
        cfg = config or get_config()
        api_key = cfg.server.api_key
        self.valid_api_keys: Set[str] = {api_key} if api_key and api_key.strip() else set()

    @staticmethod
    def _is_proxy_path(path: str) -> bool:
        if ".." in path:
            return False
        return bool(AuthMiddleware._PROXY_PATH_RE.match(path))

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        if any(path.startswith(p) for p in self.EXEMPT_PATHS):
            await self.app(scope, receive, send)
            return

        if self._is_proxy_path(path):
            await self.app(scope, receive, send)
            return

        if not self.valid_api_keys:
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        api_key = headers.get(self.API_KEY_HEADER.encode(), b"").decode()

        if not api_key:
            await self._send_error(send, 401, "MISSING_API_KEY",
                "Authentication credentials are missing. Provide API key via OPEN-SANDBOX-API-KEY header.")
            return

        if api_key not in self.valid_api_keys:
            await self._send_error(send, 401, "INVALID_API_KEY",
                "Authentication credentials are invalid. Check your API key and try again.")
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _send_error(send: Send, status: int, code: str, message: str) -> None:
        body = json.dumps({"code": code, "message": message}).encode()
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [
                [b"content-type", b"application/json"],
                [b"content-length", str(len(body)).encode()],
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })
