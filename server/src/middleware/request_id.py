"""
Request ID middleware and logging context for OpenSandbox Lifecycle API.

Pure ASGI middleware to avoid buffering streaming responses.
Reads X-Request-ID from incoming requests (or generates one), stores it in
contextvars so that all logs emitted during that request can be correlated.
"""

import logging
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Receive, Scope, Send

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)

X_REQUEST_ID_HEADER = "x-request-id"


def get_request_id() -> str | None:
    return request_id_ctx.get()


class RequestIdMiddleware:
    """Pure ASGI middleware that sets request ID without buffering responses."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        raw = headers.get(X_REQUEST_ID_HEADER.encode(), b"").decode().strip()
        request_id = raw or uuid.uuid4().hex
        token = request_id_ctx.set(request_id)

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                h = list(message.get("headers", []))
                h.append([b"x-request-id", request_id.encode()])
                message = {**message, "headers": h}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_ctx.reset(token)


class RequestIdFilter(logging.Filter):
    """Injects the current request_id from context into each log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        rid = get_request_id()
        setattr(record, "request_id", rid if rid else "-")
        return True
