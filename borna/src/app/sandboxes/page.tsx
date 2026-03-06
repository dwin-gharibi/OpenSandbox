"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Plus,
  Trash2,
  Pause,
  Play,
  Eye,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  listSandboxes,
  deleteSandbox,
  pauseSandbox,
  resumeSandbox,
  type Sandbox,
  type PaginationInfo,
} from "@/lib/api";

export default function SandboxesPage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [metadataFilter, setMetadataFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSandboxes = async () => {
    try {
      const states = stateFilter ? [stateFilter] : undefined;
      const res = await listSandboxes({ state: states, metadata: metadataFilter || undefined, page, pageSize: 20 });
      setSandboxes(res.items);
      setPagination(res.pagination);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSandboxes();
  }, [page, stateFilter, metadataFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete sandbox ${id.slice(0, 12)}...?`)) return;
    try {
      await deleteSandbox(id);
      fetchSandboxes();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseSandbox(id);
      fetchSandboxes();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeSandbox(id);
      fetchSandboxes();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const stateColor: Record<string, string> = {
    Running: "badge-healthy",
    Pending: "badge-unknown",
    Paused: "badge-degraded",
    Failed: "badge-unhealthy",
    Terminated: "badge-unhealthy",
    Stopping: "badge-degraded",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sandboxes</h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Manage sandbox lifecycle — create, pause, resume, delete
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchSandboxes} className="btn btn-ghost">
              <RefreshCw className="w-4 h-4" />
            </button>
            <Link href="/sandboxes/create" className="btn btn-primary">
              <Plus className="w-4 h-4" /> Create Sandbox
            </Link>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="min-w-[160px]"
          >
            <option value="">All States</option>
            <option value="Running">Running</option>
            <option value="Pending">Pending</option>
            <option value="Paused">Paused</option>
            <option value="Terminated">Terminated</option>
            <option value="Failed">Failed</option>
          </select>
          <input
            type="text"
            placeholder="Metadata filter (key=value&key2=value2)"
            value={metadataFilter}
            onChange={(e) => { setMetadataFilter(e.target.value); setPage(1); }}
            className="flex-1 min-w-[200px]"
          />
          {pagination && (
            <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">
              {pagination.totalItems} sandbox{pagination.totalItems !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {error && (
          <div className="card border-[var(--danger)] text-[var(--danger)] text-sm">{error}</div>
        )}

        <div className="card p-0">
          {loading ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
          ) : sandboxes.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No sandboxes found</p>
              <Link href="/sandboxes/create" className="btn btn-primary mt-4 inline-flex">
                <Plus className="w-4 h-4" /> Create your first sandbox
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Image</th>
                    <th>State</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sandboxes.map((sb) => (
                    <tr key={sb.id}>
                      <td>
                        <Link href={`/sandboxes/${sb.id}`} className="font-mono text-sm text-[var(--accent)] hover:underline">
                          {sb.id.slice(0, 12)}...
                        </Link>
                      </td>
                      <td className="font-mono text-sm">{sb.image.uri}</td>
                      <td>
                        <span className={`badge ${stateColor[sb.status.state] || "badge-unknown"}`}>
                          {sb.status.state}
                        </span>
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {new Date(sb.createdAt).toLocaleString()}
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {new Date(sb.expiresAt).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <Link href={`/sandboxes/${sb.id}`} className="btn btn-ghost p-1.5" title="View Details">
                            <Eye className="w-4 h-4" />
                          </Link>
                          {sb.status.state === "Running" && (
                            <button onClick={() => handlePause(sb.id)} className="btn btn-ghost p-1.5" title="Pause">
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {sb.status.state === "Paused" && (
                            <button onClick={() => handleResume(sb.id)} className="btn btn-ghost p-1.5" title="Resume">
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(sb.id)} className="btn btn-ghost p-1.5" title="Delete">
                            <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn btn-ghost" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
