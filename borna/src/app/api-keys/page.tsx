"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Ban, Shield, Copy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createApiKey, listApiKeys, deleteApiKey, revokeApiKey, type ApiKeyInfo } from "@/lib/api";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("user");
  const [newRateLimit, setNewRateLimit] = useState("");
  const [newQuota, setNewQuota] = useState("");
  const [createdKey, setCreatedKey] = useState("");

  const fetchKeys = async () => {
    try { setKeys(await listApiKeys()); } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await createApiKey(
        newKeyName,
        newKeyRole,
        newRateLimit ? Number(newRateLimit) : undefined,
        newQuota ? Number(newQuota) : undefined,
      );
      setCreatedKey(result.key);
      setNewKeyName("");
      setNewRateLimit("");
      setNewQuota("");
      fetchKeys();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Delete this API key?")) return;
    try { await deleteApiKey(keyId); fetchKeys(); } catch (e: any) { alert(e.message); }
  };

  const handleRevoke = async (keyId: string) => {
    try { await revokeApiKey(keyId); fetchKeys(); } catch (e: any) { alert(e.message); }
  };

  const roleColor: Record<string, string> = { admin: "text-[var(--danger)]", user: "text-[var(--accent)]", viewer: "text-[var(--text-secondary)]" };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-[var(--text-secondary)] mt-1">Multi-key RBAC with admin, user, and viewer roles</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setCreatedKey(""); }}>
            <Plus className="w-4 h-4" /> Create Key
          </button>
        </div>

        {showCreate && (
          <div className="card space-y-4">
            <h3 className="font-semibold">New API Key</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Key name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              <select value={newKeyRole} onChange={(e) => setNewKeyRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="viewer">Viewer</option>
              </select>
              <input type="number" placeholder="Rate limit / min (optional)" value={newRateLimit} onChange={(e) => setNewRateLimit(e.target.value)} />
              <input type="number" placeholder="Sandbox quota (optional)" value={newQuota} onChange={(e) => setNewQuota(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            {createdKey && (
              <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--success)]">
                <p className="text-sm text-[var(--success)] font-semibold mb-2">Key created! Copy it now:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono break-all">{createdKey}</code>
                  <button onClick={() => navigator.clipboard.writeText(createdKey)} className="btn btn-ghost p-1.5"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card p-0">
          {loading ? <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div> : keys.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">No API keys configured</div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Name</th><th>Key</th><th>Role</th><th>Status</th><th>Last Used</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <td className="font-medium">{k.name}</td>
                      <td className="font-mono text-sm">{k.key_prefix}</td>
                      <td><span className={`flex items-center gap-1 ${roleColor[k.role] || ""}`}><Shield className="w-3 h-3" />{k.role}</span></td>
                      <td><span className={`badge ${k.is_active ? "badge-healthy" : "badge-unhealthy"}`}>{k.is_active ? "Active" : "Revoked"}</span></td>
                      <td className="text-[var(--text-secondary)] text-sm">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "Never"}</td>
                      <td className="text-[var(--text-secondary)] text-sm">{new Date(k.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="flex gap-1">
                          {k.is_active && <button className="btn btn-ghost p-1.5" onClick={() => handleRevoke(k.id)} title="Revoke"><Ban className="w-4 h-4" /></button>}
                          <button className="btn btn-ghost p-1.5" onClick={() => handleDelete(k.id)} title="Delete"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button>
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
    </AppShell>
  );
}
