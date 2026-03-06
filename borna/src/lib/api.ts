const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";

function getApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("opensandbox_api_key") || "";
}

export function setApiKey(key: string) {
  localStorage.setItem("opensandbox_api_key", key);
}

export function clearApiKey() {
  localStorage.removeItem("opensandbox_api_key");
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "OPEN-SANDBOX-API-KEY": getApiKey(),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    throw new AuthError("Invalid or missing API key");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message || `API error: ${res.status}`, res.status, body.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || "UNKNOWN";
  }
}

// ============================================================================
// Type definitions for every backend model
// ============================================================================

export interface ImageSpec {
  uri: string;
  auth?: { username: string; password: string };
}

export interface SandboxStatus {
  state: string;
  reason?: string;
  message?: string;
  lastTransitionAt?: string;
}

export interface NetworkRule {
  action: string;
  target: string;
}

export interface NetworkPolicy {
  defaultAction?: string;
  egress: NetworkRule[];
}

export interface Volume {
  name: string;
  host?: { path: string };
  pvc?: { claimName: string };
  mountPath: string;
  readOnly?: boolean;
  subPath?: string;
}

export interface Sandbox {
  id: string;
  image: ImageSpec;
  status: SandboxStatus;
  metadata?: Record<string, string>;
  entrypoint: string[];
  expiresAt: string;
  createdAt: string;
}

export interface CreateSandboxRequest {
  image: ImageSpec;
  timeout: number;
  resourceLimits: Record<string, string>;
  entrypoint: string[];
  env?: Record<string, string>;
  metadata?: Record<string, string>;
  networkPolicy?: NetworkPolicy;
  volumes?: Volume[];
}

export interface CreateSandboxResponse {
  id: string;
  status: SandboxStatus;
  metadata?: Record<string, string>;
  expiresAt: string;
  createdAt: string;
  entrypoint: string[];
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ListSandboxesResponse {
  items: Sandbox[];
  pagination: PaginationInfo;
}

export interface Endpoint {
  endpoint: string;
  headers?: Record<string, string>;
}

export interface RenewExpirationResponse {
  expiresAt: string;
}

export interface SnapshotInfo {
  id: string;
  sandbox_id: string;
  image_tag: string;
  created_at: string;
  size_bytes: number;
  description: string;
  metadata: Record<string, unknown>;
}

export interface CloneResponse {
  id: string;
  source_sandbox_id: string;
  status: string;
  created_at: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  key_prefix: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string;
  name: string;
  role: string;
  created_at: string;
}

export interface WebhookInfo {
  id: string;
  url: string;
  events: string[] | null;
  created_at: string;
  secret?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  outcome: string;
  details: Record<string, unknown>;
  ip_address: string;
  request_id: string;
}

export interface AuditResponse {
  items: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface CostSummary {
  total_cost: number;
  sandbox_count: number;
}

export interface SandboxCost {
  sandbox_id: string;
  total_cost: number;
  breakdown: Record<string, number>;
}

export interface ApiKeyCost {
  api_key: string;
  total_cost: number;
  breakdown: Record<string, number>;
}

export interface ShareInfo {
  id: string;
  sandbox_id: string;
  permissions: string[];
  label: string;
  created_at: string;
  expires_at: string | null;
  use_count: number;
  max_uses: number | null;
  token_prefix: string;
}

export interface ShareCreateResponse {
  id: string;
  token: string;
  sandbox_id: string;
  permissions: string[];
  created_at: string;
  expires_at: string | null;
}

export interface ShareValidation {
  sandbox_id: string;
  permissions: string[];
  remaining_uses: number | null;
}

export interface DashboardData {
  total_sandboxes: number;
  running: number;
  paused: number;
  failed: number;
  pending: number;
  healthy: number;
  unhealthy: number;
  degraded: number;
  unknown: number;
  avg_response_time_ms: number;
  avg_cpu_percent: number;
  avg_memory_percent: number;
  uptime_seconds: number;
  requests_per_minute: number;
  sandboxes: SandboxHealthInfo[];
}

export interface SandboxHealthInfo {
  sandbox_id: string;
  image?: string;
  state?: string;
  status: string;
  last_check: string;
  response_time_ms: number;
  cpu_percent: number;
  memory_percent: number;
  created_at?: string;
  expires_at?: string;
}

export interface SandboxHealth {
  sandbox_id: string;
  status: string;
  last_check?: string;
  response_time_ms?: number;
  cpu_percent?: number;
  memory_percent?: number;
  checks_passed?: number;
  checks_failed?: number;
}

export interface AutoExtendStats {
  sandbox_id: string;
  extension_count: number;
  max_extensions: number;
  last_activity: number | null;
  enabled: boolean;
}

export interface RateLimitInfo {
  api_key: string;
  limits: {
    minute_remaining: number;
    hour_remaining: number;
    create_remaining: number;
  };
}

// ============================================================================
// API functions for every endpoint
// ============================================================================

// --- Health ---
export const checkHealth = () => apiFetch<{ status: string }>("/health");

// --- Sandbox Lifecycle ---
export const createSandbox = (req: CreateSandboxRequest) =>
  apiFetch<CreateSandboxResponse>("/sandboxes", { method: "POST", body: JSON.stringify(req) });

export const listSandboxes = (params?: { state?: string[]; metadata?: string; page?: number; pageSize?: number }) => {
  const q = new URLSearchParams();
  if (params?.state) params.state.forEach((s) => q.append("state", s));
  if (params?.metadata) q.set("metadata", params.metadata);
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  return apiFetch<ListSandboxesResponse>(`/sandboxes?${q.toString()}`);
};

export const getSandbox = (id: string) => apiFetch<Sandbox>(`/sandboxes/${id}`);

export const deleteSandbox = (id: string) =>
  apiFetch<void>(`/sandboxes/${id}`, { method: "DELETE" });

export const pauseSandbox = (id: string) =>
  apiFetch<void>(`/sandboxes/${id}/pause`, { method: "POST" });

export const resumeSandbox = (id: string) =>
  apiFetch<void>(`/sandboxes/${id}/resume`, { method: "POST" });

export const renewExpiration = (id: string, expiresAt: string) =>
  apiFetch<RenewExpirationResponse>(`/sandboxes/${id}/renew-expiration`, {
    method: "POST",
    body: JSON.stringify({ expiresAt }),
  });

export const getEndpoint = (id: string, port: number, useServerProxy = false) =>
  apiFetch<Endpoint>(`/sandboxes/${id}/endpoints/${port}?use_server_proxy=${useServerProxy}`);

// --- Snapshots ---
export const createSnapshot = (sandboxId: string, description = "") =>
  apiFetch<SnapshotInfo>(`/sandboxes/${sandboxId}/snapshots`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });

export const listSnapshots = (sandboxId: string) =>
  apiFetch<SnapshotInfo[]>(`/sandboxes/${sandboxId}/snapshots`);

export const getSnapshot = (snapshotId: string) =>
  apiFetch<SnapshotInfo>(`/snapshots/${snapshotId}`);

export const deleteSnapshot = (snapshotId: string) =>
  apiFetch<void>(`/snapshots/${snapshotId}`, { method: "DELETE" });

// --- Clone ---
export const cloneSandbox = (sourceSandboxId: string, timeout = 3600) =>
  apiFetch<CloneResponse>("/sandboxes/clone", {
    method: "POST",
    body: JSON.stringify({ sourceSandboxId, timeout }),
  });

// --- Metrics ---
export const getPrometheusMetrics = () =>
  fetch(`${API_BASE}/metrics/prometheus`).then((r) => r.text());

// --- Rate Limit ---
export const getRateLimit = () => apiFetch<RateLimitInfo>("/rate-limit");

// --- API Keys ---
export const createApiKey = (name: string, role: string, rateLimit?: number, sandboxQuota?: number) =>
  apiFetch<ApiKeyCreateResponse>("/admin/api-keys", {
    method: "POST",
    body: JSON.stringify({ name, role, rateLimit, sandboxQuota }),
  });

export const listApiKeys = () => apiFetch<ApiKeyInfo[]>("/admin/api-keys");

export const deleteApiKey = (keyId: string) =>
  apiFetch<void>(`/admin/api-keys/${keyId}`, { method: "DELETE" });

export const revokeApiKey = (keyId: string) =>
  apiFetch<{ status: string }>(`/admin/api-keys/${keyId}/revoke`, { method: "POST" });

// --- Webhooks ---
export const registerWebhook = (url: string, secret = "", events?: string[]) =>
  apiFetch<WebhookInfo>("/admin/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, secret, events: events || null }),
  });

export const listWebhooks = () => apiFetch<WebhookInfo[]>("/admin/webhooks");

export const deleteWebhook = (id: string) =>
  apiFetch<void>(`/admin/webhooks/${id}`, { method: "DELETE" });

// --- Audit ---
export const queryAudit = (params: {
  actor?: string;
  action?: string;
  resourceId?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}) => {
  const q = new URLSearchParams();
  if (params.actor) q.set("actor", params.actor);
  if (params.action) q.set("action", params.action);
  if (params.resourceId) q.set("resourceId", params.resourceId);
  if (params.since) q.set("since", params.since);
  if (params.until) q.set("until", params.until);
  q.set("limit", String(params.limit || 50));
  q.set("offset", String(params.offset || 0));
  return apiFetch<AuditResponse>(`/admin/audit?${q.toString()}`);
};

// --- Cost ---
export const getCostSummary = (since?: string, until?: string) => {
  const q = new URLSearchParams();
  if (since) q.set("since", since);
  if (until) q.set("until", until);
  return apiFetch<CostSummary>(`/admin/cost/summary?${q.toString()}`);
};

export const getSandboxCost = (sandboxId: string) =>
  apiFetch<SandboxCost>(`/sandboxes/${sandboxId}/cost`);

export const getCostByApiKey = (apiKey: string, since?: string) => {
  const q = new URLSearchParams({ apiKey });
  if (since) q.set("since", since);
  return apiFetch<ApiKeyCost>(`/admin/cost/by-key?${q.toString()}`);
};

// --- Sharing ---
export const createShare = (
  sandboxId: string,
  permissions: string[],
  label = "",
  expiresInHours?: number,
  maxUses?: number
) =>
  apiFetch<ShareCreateResponse>(`/sandboxes/${sandboxId}/shares`, {
    method: "POST",
    body: JSON.stringify({ permissions, label, expiresInHours, maxUses }),
  });

export const listShares = (sandboxId: string) =>
  apiFetch<ShareInfo[]>(`/sandboxes/${sandboxId}/shares`);

export const revokeShare = (shareId: string) =>
  apiFetch<void>(`/shares/${shareId}`, { method: "DELETE" });

export const validateShareToken = (token: string) =>
  apiFetch<ShareValidation>(`/shares/validate?token=${encodeURIComponent(token)}`, { method: "POST" });

// --- Dashboard / Health ---
export const getDashboard = () => apiFetch<DashboardData>("/admin/dashboard");

export const getSandboxHealth = (sandboxId: string) =>
  apiFetch<SandboxHealth>(`/sandboxes/${sandboxId}/health`);

// --- Auto-Extend ---
export const getAutoExtend = (sandboxId: string) =>
  apiFetch<AutoExtendStats>(`/sandboxes/${sandboxId}/auto-extend`);

// --- Extensions ---
export interface ExtensionInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  tags: string[];
  ports: number[];
  env: Record<string, string>;
  packages: string[];
  resource_hints: Record<string, string>;
  setup_commands?: string[];
}

export const listExtensions = (params?: { category?: string; q?: string }) => {
  const query = new URLSearchParams();
  if (params?.category) query.set("category", params.category);
  if (params?.q) query.set("q", params.q);
  return apiFetch<ExtensionInfo[]>(`/extensions?${query.toString()}`);
};

export const getExtension = (id: string) => apiFetch<ExtensionInfo>(`/extensions/${id}`);

export const getExtensionCategories = () => apiFetch<string[]>("/extensions/categories");

export const applyExtensions = (sandboxId: string, extensions: string[]) =>
  apiFetch<{ sandbox_id: string; extensions: string[]; setup_script: string; env: Record<string, string>; ports: number[] }>(
    `/sandboxes/${sandboxId}/extensions`,
    { method: "POST", body: JSON.stringify({ extensions }) },
  );

// --- Proxy helpers for execd (commands, code, files) ---
export const proxyUrl = (sandboxId: string, port: number, path: string) =>
  `${API_BASE}/sandboxes/${sandboxId}/proxy/${port}/${path}`;

export const execCommand = (sandboxId: string, port: number, command: string, timeout = 30) =>
  fetch(proxyUrl(sandboxId, port, "command"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, timeout, background: false }),
  });

export const execCode = (sandboxId: string, port: number, code: string, language: string) =>
  fetch(proxyUrl(sandboxId, port, "code"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language }),
  });

export const listFiles = (sandboxId: string, port: number, path: string) =>
  fetch(proxyUrl(sandboxId, port, `files/info?path=${encodeURIComponent(path)}`))
    .then((r) => r.json());

export const downloadFile = (sandboxId: string, port: number, path: string) =>
  fetch(proxyUrl(sandboxId, port, `files/download?path=${encodeURIComponent(path)}`));

export const uploadFiles = (sandboxId: string, port: number, formData: FormData) =>
  fetch(proxyUrl(sandboxId, port, "files/upload"), { method: "POST", body: formData });

export const getMetricsFromSandbox = (sandboxId: string, port: number) =>
  fetch(proxyUrl(sandboxId, port, "metrics")).then((r) => r.json());

export const pingSandbox = (sandboxId: string, port: number) =>
  fetch(proxyUrl(sandboxId, port, "ping")).then((r) => r.json());
