"use client";

import { useEffect, useState } from "react";
import { Webhook, Plus, Trash2, Globe } from "lucide-react";
import { apiFetch, type WebhookInfo } from "@/lib/api";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const fetchWebhooks = async () => {
    try {
      const data = await apiFetch<WebhookInfo[]>("/admin/webhooks");
      setWebhooks(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    try {
      await apiFetch("/admin/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: newUrl, secret: newSecret }),
      });
      setNewUrl("");
      setNewSecret("");
      setShowCreate(false);
      fetchWebhooks();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;
    try {
      await apiFetch(`/admin/webhooks/${webhookId}`, { method: "DELETE" });
      fetchWebhooks();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Configure webhook endpoints for sandbox lifecycle events
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {showCreate && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Register Webhook</h3>
          <div className="space-y-3">
            <input
              type="url"
              placeholder="Webhook URL (https://...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full"
            />
            <input
              type="text"
              placeholder="Shared secret (optional)"
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              className="w-full"
            />
            <button className="btn btn-primary" onClick={handleCreate}>
              Register
            </button>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p className="text-[var(--text-secondary)]">Loading...</p>
        ) : webhooks.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No webhooks configured</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id}>
                    <td className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--accent)]" />
                        {wh.url}
                      </div>
                    </td>
                    <td>
                      {wh.events ? (
                        <div className="flex gap-1 flex-wrap">
                          {wh.events.map((e) => (
                            <span key={e} className="badge badge-healthy">
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)]">
                          All events
                        </span>
                      )}
                    </td>
                    <td className="text-[var(--text-secondary)]">
                      {new Date(wh.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 className="w-4 h-4 text-[var(--danger)]" />
                      </button>
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
