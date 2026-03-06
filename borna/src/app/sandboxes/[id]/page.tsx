"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Trash2, Pause, Play, Clock, Camera, Copy, Share2,
  Heart, Shield, Globe, RefreshCw, Timer,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  getSandbox, deleteSandbox, pauseSandbox, resumeSandbox, renewExpiration,
  getEndpoint, getSandboxHealth, getSandboxCost, getAutoExtend,
  createSnapshot, listSnapshots, deleteSnapshot, cloneSandbox,
  createShare, listShares, revokeShare,
  type Sandbox, type SandboxHealth, type SandboxCost, type AutoExtendStats,
  type SnapshotInfo, type ShareInfo, type Endpoint,
} from "@/lib/api";

export default function SandboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [health, setHealth] = useState<SandboxHealth | null>(null);
  const [cost, setCost] = useState<SandboxCost | null>(null);
  const [autoExtend, setAutoExtend] = useState<AutoExtendStats | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "snapshots" | "shares" | "endpoints">("overview");

  const fetchAll = async () => {
    try {
      const [sb, h, c, ae, snaps, sh] = await Promise.all([
        getSandbox(id).catch(() => null),
        getSandboxHealth(id).catch(() => null),
        getSandboxCost(id).catch(() => null),
        getAutoExtend(id).catch(() => null),
        listSnapshots(id).catch(() => []),
        listShares(id).catch(() => []),
      ]);
      if (!sb) { setError("Sandbox not found"); setLoading(false); return; }
      setSandbox(sb);
      setHealth(h);
      setCost(c);
      setAutoExtend(ae);
      setSnapshots(snaps);
      setShares(sh);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleDelete = async () => {
    if (!confirm("Delete this sandbox?")) return;
    try { await deleteSandbox(id); router.push("/sandboxes"); } catch (e: any) { alert(e.message); }
  };

  const handlePause = async () => {
    try { await pauseSandbox(id); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const handleResume = async () => {
    try { await resumeSandbox(id); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const handleRenew = async () => {
    const hours = prompt("Extend by how many hours?", "1");
    if (!hours) return;
    try {
      const newExp = new Date(Date.now() + Number(hours) * 3600000).toISOString();
      await renewExpiration(id, newExp);
      fetchAll();
    } catch (e: any) { alert(e.message); }
  };

  const handleGetEndpoint = async () => {
    const port = prompt("Port number:", "8080");
    if (!port) return;
    try {
      const ep = await getEndpoint(id, Number(port));
      setEndpoint(ep);
    } catch (e: any) { alert(e.message); }
  };

  const handleSnapshot = async () => {
    const desc = prompt("Snapshot description:");
    try { await createSnapshot(id, desc || ""); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const handleDeleteSnapshot = async (snapId: string) => {
    if (!confirm("Delete this snapshot?")) return;
    try { await deleteSnapshot(snapId); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const handleClone = async () => {
    try { const res = await cloneSandbox(id); alert(`Clone created: ${res.id.slice(0, 12)}...`); } catch (e: any) { alert(e.message); }
  };

  const handleShare = async () => {
    try {
      const res = await createShare(id, ["read", "write"], "Shared via Borna");
      prompt("Share token (copy it):", res.token);
      fetchAll();
    } catch (e: any) { alert(e.message); }
  };

  const handleRevokeShare = async (shareId: string) => {
    if (!confirm("Revoke this share?")) return;
    try { await revokeShare(shareId); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const stateColor: Record<string, string> = {
    Running: "badge-healthy", Pending: "badge-unknown", Paused: "badge-degraded",
    Failed: "badge-unhealthy", Terminated: "badge-unhealthy",
  };

  if (loading) return <AppShell><div className="flex items-center justify-center h-64 text-[var(--text-secondary)]">Loading...</div></AppShell>;
  if (error && !sandbox) return <AppShell><div className="card border-[var(--danger)] text-[var(--danger)]">{error}</div></AppShell>;
  if (!sandbox) return null;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "snapshots", label: `Snapshots (${snapshots.length})` },
    { key: "shares", label: `Shares (${shares.length})` },
    { key: "endpoints", label: "Endpoints" },
  ] as const;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/sandboxes" className="btn btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <h1 className="text-xl font-bold font-mono">{sandbox.id.slice(0, 20)}...</h1>
              <p className="text-sm text-[var(--text-secondary)]">{sandbox.image.uri}</p>
            </div>
            <span className={`badge ${stateColor[sandbox.status.state] || "badge-unknown"}`}>{sandbox.status.state}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAll} className="btn btn-ghost" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
            {sandbox.status.state === "Running" && <button onClick={handlePause} className="btn btn-ghost"><Pause className="w-4 h-4" /> Pause</button>}
            {sandbox.status.state === "Paused" && <button onClick={handleResume} className="btn btn-ghost"><Play className="w-4 h-4" /> Resume</button>}
            <button onClick={handleRenew} className="btn btn-ghost"><Timer className="w-4 h-4" /> Renew</button>
            <button onClick={handleDelete} className="btn btn-ghost text-[var(--danger)]"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)]">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card space-y-4">
              <h3 className="font-semibold">Details</h3>
              {[["ID", sandbox.id], ["Image", sandbox.image.uri], ["Entrypoint", sandbox.entrypoint.join(" ")], ["Created", new Date(sandbox.createdAt).toLocaleString()], ["Expires", new Date(sandbox.expiresAt).toLocaleString()], ["State", sandbox.status.state]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{k}</span>
                  <span className="font-mono text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
              {sandbox.metadata && Object.keys(sandbox.metadata).length > 0 && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Metadata</p>
                  {Object.entries(sandbox.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{k}</span><span>{v}</span></div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {health && (
                <div className="card space-y-3">
                  <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-[var(--accent)]" /><h3 className="font-semibold">Health</h3></div>
                  {[["Status", health.status], ["Response Time", `${health.response_time_ms || 0}ms`], ["CPU", `${health.cpu_percent || 0}%`], ["Memory", `${health.memory_percent || 0}%`], ["Checks Passed", health.checks_passed], ["Checks Failed", health.checks_failed]].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{k}</span><span>{String(v)}</span></div>
                  ))}
                </div>
              )}
              {cost && (
                <div className="card space-y-3">
                  <h3 className="font-semibold">Cost</h3>
                  <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Total</span><span className="font-bold text-[var(--warning)]">${cost.total_cost.toFixed(6)}</span></div>
                  {Object.entries(cost.breakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{k}</span><span>${v.toFixed(6)}</span></div>
                  ))}
                </div>
              )}
              {autoExtend && (
                <div className="card space-y-3">
                  <div className="flex items-center gap-2"><Timer className="w-4 h-4 text-[var(--accent)]" /><h3 className="font-semibold">Auto-Extend</h3></div>
                  {[["Enabled", autoExtend.enabled ? "Yes" : "No"], ["Extensions", `${autoExtend.extension_count} / ${autoExtend.max_extensions}`]].map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">{k}</span><span>{String(v)}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "snapshots" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <button onClick={handleSnapshot} className="btn btn-primary"><Camera className="w-4 h-4" /> Create Snapshot</button>
              <button onClick={handleClone} className="btn btn-ghost"><Copy className="w-4 h-4" /> Clone Sandbox</button>
            </div>
            {snapshots.length === 0 ? (
              <div className="card text-[var(--text-secondary)] text-center py-8">No snapshots yet</div>
            ) : (
              <div className="card p-0 table-container">
                <table>
                  <thead><tr><th>ID</th><th>Image Tag</th><th>Description</th><th>Created</th><th>Actions</th></tr></thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-sm">{s.id.slice(0, 12)}</td>
                        <td className="font-mono text-sm">{s.image_tag}</td>
                        <td>{s.description || "-"}</td>
                        <td className="text-[var(--text-secondary)]">{new Date(s.created_at).toLocaleString()}</td>
                        <td><button onClick={() => handleDeleteSnapshot(s.id)} className="btn btn-ghost p-1.5"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "shares" && (
          <div className="space-y-4">
            <button onClick={handleShare} className="btn btn-primary"><Share2 className="w-4 h-4" /> Create Share</button>
            {shares.length === 0 ? (
              <div className="card text-[var(--text-secondary)] text-center py-8">No shares yet</div>
            ) : (
              <div className="card p-0 table-container">
                <table>
                  <thead><tr><th>Token</th><th>Permissions</th><th>Label</th><th>Uses</th><th>Expires</th><th>Actions</th></tr></thead>
                  <tbody>
                    {shares.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-sm">{s.token_prefix}</td>
                        <td>{s.permissions.map((p) => <span key={p} className="badge badge-healthy mr-1">{p}</span>)}</td>
                        <td>{s.label || "-"}</td>
                        <td>{s.use_count}{s.max_uses ? ` / ${s.max_uses}` : ""}</td>
                        <td className="text-[var(--text-secondary)]">{s.expires_at ? new Date(s.expires_at).toLocaleString() : "Never"}</td>
                        <td><button onClick={() => handleRevokeShare(s.id)} className="btn btn-ghost p-1.5"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "endpoints" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <button onClick={handleGetEndpoint} className="btn btn-primary"><Globe className="w-4 h-4" /> Lookup Endpoint</button>
            </div>
            {endpoint && (
              <div className="card space-y-3">
                <h3 className="font-semibold">Endpoint</h3>
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg font-mono text-sm break-all">{endpoint.endpoint}</div>
                {endpoint.headers && Object.keys(endpoint.headers).length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Required Headers</p>
                    {Object.entries(endpoint.headers).map(([k, v]) => (
                      <div key={k} className="font-mono text-sm">{k}: {v}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="card">
              <h3 className="font-semibold mb-3">WebSocket Proxy</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Connect via WebSocket at: <code className="text-[var(--accent)]">ws://&lt;server&gt;/sandboxes/{id}/ws/&lt;port&gt;/&lt;path&gt;</code>
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
