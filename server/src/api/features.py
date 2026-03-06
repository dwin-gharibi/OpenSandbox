"""
API routes for OpenSandbox new features.

Includes endpoints for: snapshots, cloning, metrics, rate-limit info,
RBAC key management, webhooks, audit logs, cost tracking, sharing,
health monitoring dashboard, and WebSocket proxy.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, Query, Request, WebSocket, WebSocketDisconnect, status
from fastapi.exceptions import HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.services.audit import get_audit_log
from src.services.auto_extend import get_auto_extend_manager
from src.services.cost_tracker import get_cost_tracker
from src.services.event_bus import EventType, SandboxEvent, get_event_bus
from src.services.health_monitor import get_health_monitor
from src.services.metrics_collector import (
    CLONE_COUNT,
    SNAPSHOT_COUNT,
    WEBSOCKET_CONNECTIONS,
    get_content_type,
    get_metrics,
)
from src.services.rate_limiter import get_rate_limiter
from src.services.rbac import get_rbac_manager
from src.services.sharing import get_sharing_manager
from src.services.snapshots import get_snapshot_manager

logger = logging.getLogger(__name__)

features_router = APIRouter(tags=["Features"])


# ============================================================================
# Pydantic models for feature endpoints
# ============================================================================

class CreateSnapshotRequest(BaseModel):
    description: str = Field("", description="Human-readable description of the snapshot")


class CreateSnapshotResponse(BaseModel):
    id: str
    sandbox_id: str
    image_tag: str
    created_at: str
    description: str


class CloneSandboxRequest(BaseModel):
    source_sandbox_id: str = Field(..., alias="sourceSandboxId", description="ID of the sandbox to clone")
    timeout: int = Field(3600, ge=60, le=86400, description="Timeout for the cloned sandbox")

    class Config:
        populate_by_name = True


class CloneSandboxResponse(BaseModel):
    id: str
    source_sandbox_id: str
    status: str
    created_at: str


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Human-readable name for the key")
    role: str = Field("user", description="Role: admin, user, or viewer")
    rate_limit: Optional[int] = Field(None, alias="rateLimit", description="Custom rate limit per minute")
    sandbox_quota: Optional[int] = Field(None, alias="sandboxQuota", description="Max sandboxes this key can create")

    class Config:
        populate_by_name = True


class CreateApiKeyResponse(BaseModel):
    id: str
    key: str
    name: str
    role: str
    created_at: str


class RegisterWebhookRequest(BaseModel):
    url: str = Field(..., description="Webhook delivery URL")
    events: Optional[List[str]] = Field(None, description="Event types to subscribe to (null = all)")
    secret: str = Field("", description="Shared secret for signature verification")


class RegisterWebhookResponse(BaseModel):
    id: str
    url: str
    events: Optional[List[str]]
    created_at: str


class CreateShareRequest(BaseModel):
    permissions: List[str] = Field(default=["read"], description="Permissions: read, write, admin")
    label: str = Field("", description="Human-readable label")
    expires_in_hours: Optional[int] = Field(None, alias="expiresInHours")
    max_uses: Optional[int] = Field(None, alias="maxUses")

    class Config:
        populate_by_name = True


class CreateShareResponse(BaseModel):
    id: str
    token: str
    sandbox_id: str
    permissions: List[str]
    created_at: str
    expires_at: Optional[str]


# ============================================================================
# Snapshots
# ============================================================================

@features_router.post(
    "/sandboxes/{sandbox_id}/snapshots",
    status_code=status.HTTP_201_CREATED,
    response_model=CreateSnapshotResponse,
)
async def create_snapshot(
    sandbox_id: str,
    request: CreateSnapshotRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
) -> CreateSnapshotResponse:
    mgr = get_snapshot_manager()
    snapshot = mgr.create_snapshot(
        sandbox_id=sandbox_id,
        container_id=sandbox_id,
        description=request.description,
    )
    SNAPSHOT_COUNT.inc()
    return CreateSnapshotResponse(
        id=snapshot.id,
        sandbox_id=snapshot.sandbox_id,
        image_tag=snapshot.image_tag,
        created_at=snapshot.created_at,
        description=snapshot.description,
    )


@features_router.get("/sandboxes/{sandbox_id}/snapshots")
async def list_snapshots(sandbox_id: str) -> List[Dict[str, Any]]:
    mgr = get_snapshot_manager()
    snapshots = mgr.list_snapshots(sandbox_id=sandbox_id)
    return [asdict(s) for s in snapshots]


@features_router.get("/snapshots/{snapshot_id}")
async def get_snapshot(snapshot_id: str) -> Dict[str, Any]:
    mgr = get_snapshot_manager()
    snapshot = mgr.get_snapshot(snapshot_id)
    if snapshot is None:
        raise HTTPException(status_code=404, detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot not found"})
    return asdict(snapshot)


@features_router.delete("/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot(snapshot_id: str) -> Response:
    mgr = get_snapshot_manager()
    if not mgr.delete_snapshot(snapshot_id):
        raise HTTPException(status_code=404, detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot not found"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# Cloning
# ============================================================================

@features_router.post("/sandboxes/clone", status_code=status.HTTP_201_CREATED)
async def clone_sandbox(request: CloneSandboxRequest) -> CloneSandboxResponse:
    from uuid import uuid4
    clone_id = str(uuid4())
    CLONE_COUNT.inc()

    bus = get_event_bus()
    bus.publish(SandboxEvent(
        event_type=EventType.SANDBOX_CLONED,
        sandbox_id=clone_id,
        data={"source_sandbox_id": request.source_sandbox_id, "timeout": request.timeout},
    ))

    return CloneSandboxResponse(
        id=clone_id,
        source_sandbox_id=request.source_sandbox_id,
        status="Pending",
        created_at=datetime.now(timezone.utc).isoformat(),
    )


# ============================================================================
# Prometheus Metrics
# ============================================================================

@features_router.get("/metrics/prometheus")
async def prometheus_metrics() -> Response:
    return Response(content=get_metrics(), media_type=get_content_type())


# ============================================================================
# Rate Limiting Info
# ============================================================================

@features_router.get("/rate-limit")
async def get_rate_limit_info(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="OPEN-SANDBOX-API-KEY"),
) -> Dict[str, Any]:
    limiter = get_rate_limiter()
    key = x_api_key or "anonymous"
    info = limiter.get_limits_info(key)
    return {"api_key": key[:8] + "***" if len(key) > 8 else key, "limits": info}


# ============================================================================
# RBAC / API Key Management
# ============================================================================

@features_router.post("/admin/api-keys", status_code=status.HTTP_201_CREATED)
async def create_api_key(request: CreateApiKeyRequest) -> CreateApiKeyResponse:
    mgr = get_rbac_manager()
    key = mgr.create_key(
        name=request.name,
        role=request.role,
        rate_limit=request.rate_limit,
        sandbox_quota=request.sandbox_quota,
    )
    return CreateApiKeyResponse(
        id=key.id, key=key.key, name=key.name, role=key.role, created_at=key.created_at,
    )


@features_router.get("/admin/api-keys")
async def list_api_keys() -> List[Dict[str, Any]]:
    mgr = get_rbac_manager()
    keys = mgr.list_keys()
    return [
        {
            "id": k.id,
            "name": k.name,
            "role": k.role,
            "is_active": k.is_active,
            "created_at": k.created_at,
            "last_used_at": k.last_used_at,
            "key_prefix": k.key[:12] + "***",
        }
        for k in keys
    ]


@features_router.delete("/admin/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(key_id: str) -> Response:
    mgr = get_rbac_manager()
    if not mgr.delete_key(key_id):
        raise HTTPException(status_code=404, detail={"code": "KEY_NOT_FOUND", "message": "API key not found"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@features_router.post("/admin/api-keys/{key_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_api_key(key_id: str) -> Dict[str, str]:
    mgr = get_rbac_manager()
    if not mgr.revoke_key(key_id):
        raise HTTPException(status_code=404, detail={"code": "KEY_NOT_FOUND", "message": "API key not found"})
    return {"status": "revoked", "key_id": key_id}


# ============================================================================
# Webhooks
# ============================================================================

@features_router.post("/admin/webhooks", status_code=status.HTTP_201_CREATED)
async def register_webhook(request: RegisterWebhookRequest) -> RegisterWebhookResponse:
    bus = get_event_bus()
    events = None
    if request.events:
        events = [EventType(e) for e in request.events]
    wh_id = bus.register_webhook(url=request.url, events=events, secret=request.secret)
    return RegisterWebhookResponse(
        id=wh_id, url=request.url, events=request.events,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


@features_router.get("/admin/webhooks")
async def list_webhooks() -> List[Dict[str, Any]]:
    bus = get_event_bus()
    return bus.list_webhooks()


@features_router.delete("/admin/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(webhook_id: str) -> Response:
    bus = get_event_bus()
    if not bus.unregister_webhook(webhook_id):
        raise HTTPException(status_code=404, detail={"code": "WEBHOOK_NOT_FOUND", "message": "Webhook not found"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# Audit Log
# ============================================================================

@features_router.get("/admin/audit")
async def query_audit_log(
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None, alias="resourceId"),
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    audit = get_audit_log()
    entries = audit.query(
        actor=actor, action=action, resource_id=resource_id,
        since=since, until=until, limit=limit, offset=offset,
    )
    total = audit.count(actor=actor, action=action, resource_id=resource_id)
    return {"items": entries, "total": total, "limit": limit, "offset": offset}


# ============================================================================
# Cost Tracking
# ============================================================================

@features_router.get("/admin/cost/summary")
async def cost_summary(
    since: Optional[str] = Query(None),
    until: Optional[str] = Query(None),
) -> Dict[str, Any]:
    tracker = get_cost_tracker()
    return tracker.get_summary(since=since, until=until)


@features_router.get("/sandboxes/{sandbox_id}/cost")
async def sandbox_cost(sandbox_id: str) -> Dict[str, Any]:
    tracker = get_cost_tracker()
    return tracker.get_sandbox_cost(sandbox_id)


@features_router.get("/admin/cost/by-key")
async def cost_by_api_key(
    api_key: str = Query(..., alias="apiKey"),
    since: Optional[str] = Query(None),
) -> Dict[str, Any]:
    tracker = get_cost_tracker()
    return tracker.get_api_key_cost(api_key=api_key, since=since)


# ============================================================================
# Sharing
# ============================================================================

@features_router.post("/sandboxes/{sandbox_id}/shares", status_code=status.HTTP_201_CREATED)
async def create_share(sandbox_id: str, request: CreateShareRequest) -> CreateShareResponse:
    mgr = get_sharing_manager()
    share = mgr.create_share(
        sandbox_id=sandbox_id,
        permissions=request.permissions,
        label=request.label,
        expires_in_hours=request.expires_in_hours,
        max_uses=request.max_uses,
    )
    return CreateShareResponse(
        id=share.id, token=share.token, sandbox_id=share.sandbox_id,
        permissions=share.permissions, created_at=share.created_at,
        expires_at=share.expires_at,
    )


@features_router.get("/sandboxes/{sandbox_id}/shares")
async def list_shares(sandbox_id: str) -> List[Dict[str, Any]]:
    mgr = get_sharing_manager()
    shares = mgr.list_shares(sandbox_id)
    return [
        {
            "id": s.id, "sandbox_id": s.sandbox_id, "permissions": s.permissions,
            "label": s.label, "created_at": s.created_at, "expires_at": s.expires_at,
            "use_count": s.use_count, "max_uses": s.max_uses,
            "token_prefix": s.token[:8] + "***",
        }
        for s in shares
    ]


@features_router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(share_id: str) -> Response:
    mgr = get_sharing_manager()
    if not mgr.revoke_share(share_id):
        raise HTTPException(status_code=404, detail={"code": "SHARE_NOT_FOUND", "message": "Share not found"})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@features_router.post("/shares/validate")
async def validate_share_token(
    token: str = Query(..., description="Share token to validate"),
) -> Dict[str, Any]:
    mgr = get_sharing_manager()
    share = mgr.validate_token(token)
    if share is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_SHARE_TOKEN", "message": "Share token is invalid or expired"},
        )
    return {
        "sandbox_id": share.sandbox_id,
        "permissions": share.permissions,
        "remaining_uses": (share.max_uses - share.use_count) if share.max_uses else None,
    }


# ============================================================================
# Health Monitoring Dashboard
# ============================================================================

@features_router.get("/admin/dashboard")
async def health_dashboard() -> Dict[str, Any]:
    monitor = get_health_monitor()
    dashboard = monitor.get_dashboard()
    return {
        "total_sandboxes": dashboard.total_sandboxes,
        "healthy": dashboard.healthy,
        "unhealthy": dashboard.unhealthy,
        "degraded": dashboard.degraded,
        "unknown": dashboard.unknown,
        "avg_response_time_ms": dashboard.avg_response_time_ms,
        "avg_cpu_percent": dashboard.avg_cpu_percent,
        "avg_memory_percent": dashboard.avg_memory_percent,
        "uptime_seconds": dashboard.uptime_seconds,
        "requests_per_minute": dashboard.requests_per_minute,
        "sandboxes": dashboard.sandboxes,
    }


@features_router.get("/sandboxes/{sandbox_id}/health")
async def sandbox_health(sandbox_id: str) -> Dict[str, Any]:
    monitor = get_health_monitor()
    health = monitor.get_health(sandbox_id)
    if health is None:
        return {"sandbox_id": sandbox_id, "status": "unknown"}
    return {
        "sandbox_id": health.sandbox_id,
        "status": health.status,
        "last_check": health.last_check,
        "response_time_ms": health.response_time_ms,
        "cpu_percent": health.cpu_percent,
        "memory_percent": health.memory_percent,
        "checks_passed": health.checks_passed,
        "checks_failed": health.checks_failed,
    }


# ============================================================================
# TTL Auto-Extension Info
# ============================================================================

@features_router.get("/sandboxes/{sandbox_id}/auto-extend")
async def auto_extend_status(sandbox_id: str) -> Dict[str, Any]:
    mgr = get_auto_extend_manager()
    return mgr.get_stats(sandbox_id)


# ============================================================================
# WebSocket Proxy
# ============================================================================

@features_router.websocket("/sandboxes/{sandbox_id}/ws/{port}/{path:path}")
async def websocket_proxy(websocket: WebSocket, sandbox_id: str, port: int, path: str = "") -> None:
    import websockets

    from src.services.factory import create_sandbox_service
    service = create_sandbox_service()

    try:
        endpoint = service.get_endpoint(sandbox_id, port)
    except HTTPException:
        await websocket.close(code=4004, reason="Sandbox not found")
        return

    target_url = f"ws://{endpoint.endpoint}/{path}"
    await websocket.accept()
    WEBSOCKET_CONNECTIONS.inc()

    try:
        async with websockets.connect(target_url) as ws_backend:
            async def forward_client_to_backend() -> None:
                try:
                    while True:
                        data = await websocket.receive_text()
                        await ws_backend.send(data)
                except WebSocketDisconnect:
                    pass
                except Exception:
                    pass

            async def forward_backend_to_client() -> None:
                try:
                    async for message in ws_backend:
                        if isinstance(message, str):
                            await websocket.send_text(message)
                        else:
                            await websocket.send_bytes(message)
                except Exception:
                    pass

            await asyncio.gather(
                forward_client_to_backend(),
                forward_backend_to_client(),
                return_exceptions=True,
            )
    except Exception as e:
        logger.warning("WebSocket proxy error for sandbox %s: %s", sandbox_id, e)
    finally:
        WEBSOCKET_CONNECTIONS.dec()
        try:
            await websocket.close()
        except Exception:
            pass
