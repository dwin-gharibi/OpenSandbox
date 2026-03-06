"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Camera,
  Copy,
  Share2,
  Heart,
  Clock,
  Trash2,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface SandboxInfo {
  sandbox_id: string;
  status: string;
  last_check: string;
  response_time_ms: number;
  cpu_percent: number;
  memory_percent: number;
}

interface SnapshotInfo {
  id: string;
  sandbox_id: string;
  image_tag: string;
  created_at: string;
  description: string;
}

export default function SandboxesPage() {
  const [sandboxes, setSandboxes] = useState<SandboxInfo[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [selectedSandbox, setSelectedSandbox] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboard = await apiFetch<{ sandboxes: SandboxInfo[] }>(
          "/admin/dashboard"
        );
        setSandboxes(dashboard.sandboxes || []);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSnapshot = async (sandboxId: string) => {
    try {
      const desc = prompt("Snapshot description (optional):");
      await apiFetch(`/sandboxes/${sandboxId}/snapshots`, {
        method: "POST",
        body: JSON.stringify({ description: desc || "" }),
      });
      const snaps = await apiFetch<SnapshotInfo[]>(
        `/sandboxes/${sandboxId}/snapshots`
      );
      setSnapshots(snaps);
      setSelectedSandbox(sandboxId);
      alert("Snapshot created successfully!");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleClone = async (sandboxId: string) => {
    try {
      await apiFetch("/sandboxes/clone", {
        method: "POST",
        body: JSON.stringify({ sourceSandboxId: sandboxId, timeout: 3600 }),
      });
      alert("Clone initiated successfully!");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleShare = async (sandboxId: string) => {
    try {
      const result = await apiFetch<{ token: string }>(
        `/sandboxes/${sandboxId}/shares`,
        {
          method: "POST",
          body: JSON.stringify({
            permissions: ["read", "write"],
            label: "Shared access",
          }),
        }
      );
      prompt("Share token (copy this):", result.token);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const loadSnapshots = async (sandboxId: string) => {
    try {
      const snaps = await apiFetch<SnapshotInfo[]>(
        `/sandboxes/${sandboxId}/snapshots`
      );
      setSnapshots(snaps);
      setSelectedSandbox(sandboxId);
    } catch {
      setSnapshots([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-[var(--text-secondary)]">
        Loading sandboxes...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Sandboxes</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Manage sandboxes, snapshots, cloning, and sharing
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Active Sandboxes</h2>
        {sandboxes.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No active sandboxes</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sandbox ID</th>
                  <th>Status</th>
                  <th>CPU</th>
                  <th>Memory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sandboxes.map((s) => (
                  <tr key={s.sandbox_id}>
                    <td
                      className="font-mono text-sm cursor-pointer text-[var(--accent)]"
                      onClick={() => loadSnapshots(s.sandbox_id)}
                    >
                      {s.sandbox_id.slice(0, 16)}...
                    </td>
                    <td>
                      <span className={`badge badge-${s.status}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>{s.cpu_percent}%</td>
                    <td>{s.memory_percent}%</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleSnapshot(s.sandbox_id)}
                          title="Create Snapshot"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleClone(s.sandbox_id)}
                          title="Clone"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleShare(s.sandbox_id)}
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
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

      {selectedSandbox && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">
            Snapshots for {selectedSandbox.slice(0, 12)}...
          </h2>
          {snapshots.length === 0 ? (
            <p className="text-[var(--text-secondary)]">No snapshots yet</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Image Tag</th>
                    <th>Description</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snap) => (
                    <tr key={snap.id}>
                      <td className="font-mono text-sm">
                        {snap.id.slice(0, 12)}
                      </td>
                      <td className="font-mono text-sm">{snap.image_tag}</td>
                      <td>{snap.description || "-"}</td>
                      <td className="text-[var(--text-secondary)]">
                        {new Date(snap.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
