"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Ban, Shield } from "lucide-react";
import { apiFetch, type ApiKeyInfo } from "@/lib/api";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("user");
  const [createdKey, setCreatedKey] = useState("");

  const fetchKeys = async () => {
    try {
      const data = await apiFetch<ApiKeyInfo[]>("/admin/api-keys");
      setKeys(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await apiFetch<{ key: string }>("/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName, role: newKeyRole }),
      });
      setCreatedKey(result.key);
      setNewKeyName("");
      fetchKeys();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Delete this API key?")) return;
    try {
      await apiFetch(`/admin/api-keys/${keyId}`, { method: "DELETE" });
      fetchKeys();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await apiFetch(`/admin/api-keys/${keyId}/revoke`, { method: "POST" });
      fetchKeys();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const roleColor: Record<string, string> = {
    admin: "text-[var(--danger)]",
    user: "text-[var(--accent)]",
    viewer: "text-[var(--text-secondary)]",
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Manage API keys with role-based access control
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {showCreate && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Create New API Key</h3>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Key name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1"
            />
            <select
              value={newKeyRole}
              onChange={(e) => setNewKeyRole(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn btn-primary" onClick={handleCreate}>
              Create
            </button>
          </div>
          {createdKey && (
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--success)]">
              <p className="text-sm text-[var(--success)] font-semibold">
                Key created! Copy it now, it won&apos;t be shown again:
              </p>
              <code className="block mt-2 text-sm font-mono break-all">
                {createdKey}
              </code>
            </div>
          )}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-[var(--text-secondary)]">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No API keys configured</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key Prefix</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Used</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-medium">{k.name}</td>
                    <td className="font-mono text-sm">{k.key_prefix}</td>
                    <td>
                      <span
                        className={`flex items-center gap-1 ${roleColor[k.role] || ""}`}
                      >
                        <Shield className="w-3 h-3" />
                        {k.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${k.is_active ? "badge-healthy" : "badge-unhealthy"}`}
                      >
                        {k.is_active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td className="text-[var(--text-secondary)]">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="text-[var(--text-secondary)]">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {k.is_active && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleRevoke(k.id)}
                            title="Revoke"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(k.id)}
                          title="Delete"
                        >
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
    </div>
  );
}
