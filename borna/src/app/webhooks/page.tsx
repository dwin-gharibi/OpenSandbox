"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Globe, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { registerWebhook, listWebhooks, deleteWebhook, type WebhookInfo } from "@/lib/api";

const ALL_EVENT_TYPES = [
  "sandbox.created", "sandbox.deleted", "sandbox.paused", "sandbox.resumed",
  "sandbox.expired", "sandbox.snapshot.created", "sandbox.cloned", "sandbox.shared",
  "sandbox.expiration.renewed", "sandbox.expiration.auto_extended", "sandbox.health.changed",
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [allEvents, setAllEvents] = useState(true);

  const fetchWebhooks = async () => {
    try { setWebhooks(await listWebhooks()); } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    try {
      await registerWebhook(newUrl, newSecret, allEvents ? undefined : selectedEvents.length ? selectedEvents : undefined);
      setNewUrl("");
      setNewSecret("");
      setSelectedEvents([]);
      setShowCreate(false);
      fetchWebhooks();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    try { await deleteWebhook(id); fetchWebhooks(); } catch (e: any) { alert(e.message); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Webhooks</h1>
            <p className="text-[var(--text-secondary)] mt-1">Receive HTTP callbacks for sandbox lifecycle events</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4" /> Add Webhook
          </button>
        </div>

        {showCreate && (
          <div className="card space-y-4">
            <h3 className="font-semibold">Register Webhook</h3>
            <input type="url" placeholder="https://example.com/webhook" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full" />
            <input type="text" placeholder="Shared secret (optional)" value={newSecret} onChange={(e) => setNewSecret(e.target.value)} className="w-full" />
            <div>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" checked={allEvents} onChange={(e) => setAllEvents(e.target.checked)} className="accent-[var(--accent)]" />
                Subscribe to all events
              </label>
              {!allEvents && (
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENT_TYPES.map((ev) => (
                    <button
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selectedEvents.includes(ev)
                          ? "border-[var(--accent)] bg-[var(--accent)] bg-opacity-15 text-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                      }`}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleCreate}>Register</button>
          </div>
        )}

        <div className="card p-0">
          {loading ? <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div> : webhooks.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">No webhooks configured</div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>URL</th><th>Events</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {webhooks.map((wh) => (
                    <tr key={wh.id}>
                      <td className="font-mono text-sm"><div className="flex items-center gap-2"><Globe className="w-4 h-4 text-[var(--accent)] shrink-0" />{wh.url}</div></td>
                      <td>
                        {wh.events ? (
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {wh.events.map((e) => <span key={e} className="badge badge-healthy text-[10px]">{e.replace("sandbox.", "")}</span>)}
                          </div>
                        ) : <span className="text-[var(--text-secondary)] text-sm">All events</span>}
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">{new Date(wh.created_at).toLocaleDateString()}</td>
                      <td><button className="btn btn-ghost p-1.5" onClick={() => handleDelete(wh.id)}><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button></td>
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
