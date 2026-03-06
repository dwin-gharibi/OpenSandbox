"""Tests to verify the proxy correctly forwards requests and streams SSE responses.

These tests mock the backend sandbox to return SSE data and verify:
1. Command requests are forwarded with correct body format
2. Code requests are forwarded with correct body format (context.language)
3. SSE responses stream through without buffering
4. File upload multipart is forwarded correctly
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient


class FakeSSEResponse:
    """Simulates an httpx streaming response with SSE data."""

    def __init__(self, events: list[dict], status_code: int = 200):
        self.status_code = status_code
        self._events = events
        self.headers = httpx.Headers({"content-type": "text/event-stream"})

    async def aiter_bytes(self):
        for event in self._events:
            line = f"data: {json.dumps(event)}\n\n"
            yield line.encode()

    async def aclose(self):
        pass


class FakeJSONResponse:
    """Simulates a regular JSON response."""

    def __init__(self, data: dict, status_code: int = 200):
        self.status_code = status_code
        self._data = data
        self.headers = httpx.Headers({"content-type": "application/json"})

    async def aiter_bytes(self):
        yield json.dumps(self._data).encode()

    async def aclose(self):
        pass


@pytest.fixture
def mock_sandbox_service(client, monkeypatch):
    """Mock the sandbox service to return a fake endpoint and set up http_client."""
    from src.api import lifecycle
    from src.api.schema import Endpoint

    mock_svc = MagicMock()
    mock_svc.get_endpoint.return_value = Endpoint(endpoint="10.0.0.1:44772")
    monkeypatch.setattr(lifecycle, "sandbox_service", mock_svc)

    if not hasattr(client.app.state, "http_client"):
        client.app.state.http_client = httpx.AsyncClient(timeout=30.0)

    return mock_svc


class TestProxyCommandForwarding:
    """Verify the proxy sends commands with correct body format to execd."""

    def test_command_request_forwarded(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """POST /sandboxes/{id}/proxy/{port}/command forwards correctly."""
        captured_requests = []

        async def fake_send(request, **kwargs):
            body = await request.aread()
            captured_requests.append({
                "url": str(request.url),
                "method": request.method,
                "body": json.loads(body) if body else None,
                "headers": dict(request.headers),
            })
            return FakeSSEResponse([
                {"type": "init", "text": "abc123", "timestamp": 1000},
                {"type": "stdout", "text": "hello world\n", "timestamp": 1001},
                {"type": "execution_complete", "execution_time": 50, "timestamp": 1002},
            ])

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.post(
            "/sandboxes/test-sb/proxy/44772/command",
            json={"command": "echo hello", "timeout": 30000},
        )

        assert response.status_code == 200
        assert len(captured_requests) == 1

        req = captured_requests[0]
        assert req["url"] == "http://10.0.0.1:44772/command"
        assert req["method"] == "POST"
        assert req["body"]["command"] == "echo hello"
        assert req["body"]["timeout"] == 30000

        body = response.content.decode()
        assert "stdout" in body
        assert "hello world" in body

    def test_code_request_forwarded_with_context(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """POST /sandboxes/{id}/proxy/{port}/code forwards with context.language."""
        captured_requests = []

        async def fake_send(request, **kwargs):
            body = await request.aread()
            captured_requests.append({"body": json.loads(body) if body else None})
            return FakeSSEResponse([
                {"type": "init", "text": "session1", "timestamp": 1000},
                {"type": "stdout", "text": "Python 3.11\n", "timestamp": 1001},
                {"type": "execution_complete", "execution_time": 100, "timestamp": 1002},
            ])

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.post(
            "/sandboxes/test-sb/proxy/44772/code",
            json={"code": "print('hello')", "context": {"language": "python"}},
        )

        assert response.status_code == 200
        assert len(captured_requests) == 1

        body = captured_requests[0]["body"]
        assert body["code"] == "print('hello')"
        assert body["context"]["language"] == "python"

        content = response.content.decode()
        assert "Python 3.11" in content

    def test_sse_events_streamed_through(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """Verify SSE events pass through proxy without being stripped."""

        async def fake_send(request, **kwargs):
            return FakeSSEResponse([
                {"type": "init", "text": "sess1", "timestamp": 1},
                {"type": "stdout", "text": "line1\n", "timestamp": 2},
                {"type": "stderr", "text": "warn\n", "timestamp": 3},
                {"type": "stdout", "text": "line2\n", "timestamp": 4},
                {"type": "error", "error": {"ename": "RuntimeError", "evalue": "boom", "traceback": ["trace1"]}, "timestamp": 5},
                {"type": "execution_complete", "execution_time": 200, "timestamp": 6},
            ])

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.post(
            "/sandboxes/test-sb/proxy/44772/command",
            json={"command": "test"},
        )

        assert response.status_code == 200
        content = response.content.decode()

        assert "line1" in content
        assert "line2" in content
        assert "warn" in content
        assert "RuntimeError" in content
        assert "execution_complete" in content

    def test_file_search_json_response(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """GET /files/search returns JSON array of FileInfo."""

        async def fake_send(request, **kwargs):
            return FakeJSONResponse([
                {"path": "/workspace/test.py", "size": 100, "modified_at": "2025-01-01T00:00:00Z",
                 "created_at": "2025-01-01T00:00:00Z", "owner": "root", "group": "root", "mode": 33188},
                {"path": "/workspace/data", "size": 4096, "modified_at": "2025-01-01T00:00:00Z",
                 "created_at": "2025-01-01T00:00:00Z", "owner": "root", "group": "root", "mode": 16877},
            ])

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.get("/sandboxes/test-sb/proxy/44772/files/search?path=/workspace&pattern=*")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        assert data[0]["path"] == "/workspace/test.py"
        assert data[1]["mode"] == 16877

    def test_file_upload_multipart_forwarded(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """POST /files/upload multipart is forwarded to execd."""
        captured_content_type = []

        async def fake_send(request, **kwargs):
            captured_content_type.append(request.headers.get("content-type", ""))
            return FakeJSONResponse({"status": "ok"})

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.post(
            "/sandboxes/test-sb/proxy/44772/files/upload",
            files={
                "metadata": ("metadata.json", json.dumps({"path": "/tmp/test.sh", "mode": 755}).encode(), "application/json"),
                "file": ("test.sh", b"#!/bin/bash\necho hello", "text/plain"),
            },
        )

        assert response.status_code == 200
        assert len(captured_content_type) == 1
        assert "multipart" in captured_content_type[0]

    def test_ping_forwarded(
        self, client: TestClient, mock_sandbox_service, monkeypatch
    ):
        """GET /ping health check is proxied."""

        async def fake_send(request, **kwargs):
            return FakeJSONResponse({"status": "ok"})

        monkeypatch.setattr(
            client.app.state, "http_client",
            MagicMock(build_request=httpx.AsyncClient().build_request, send=fake_send),
        )

        response = client.get("/sandboxes/test-sb/proxy/44772/ping")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
