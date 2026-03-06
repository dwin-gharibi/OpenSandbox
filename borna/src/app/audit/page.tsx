"use client";

import { useEffect, useState } from "react";
import { ScrollText, Search, Filter } from "lucide-react";
import { apiFetch, type AuditEntry } from "@/lib/api";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  const fetchAudit = async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (filterActor) params.set("actor", filterActor);
      if (filterAction) params.set("action", filterAction);

      const data = await apiFetch<{ items: AuditEntry[]; total: number }>(
        `/admin/audit?${params.toString()}`
      );
      setEntries(data.items);
      setTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [page, filterActor, filterAction]);

  const actionColor: Record<string, string> = {
    "sandbox.created": "text-[var(--success)]",
    "sandbox.deleted": "text-[var(--danger)]",
    "sandbox.paused": "text-[var(--warning)]",
    "sandbox.resumed": "text-[var(--info)]",
    "sandbox.snapshot.created": "text-[var(--accent)]",
    "sandbox.cloned": "text-[var(--accent-light)]",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Track all sandbox operations for compliance and debugging
        </p>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Filter by actor..."
            value={filterActor}
            onChange={(e) => {
              setFilterActor(e.target.value);
              setPage(0);
            }}
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Filter className="w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            placeholder="Filter by action..."
            value={filterAction}
            onChange={(e) => {
              setFilterAction(e.target.value);
              setPage(0);
            }}
            className="flex-1"
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-[var(--text-secondary)]">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="text-[var(--text-secondary)]">No audit entries found</p>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Outcome</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="font-mono text-sm">
                        {entry.actor || "-"}
                      </td>
                      <td>
                        <span
                          className={`font-medium ${actionColor[entry.action] || ""}`}
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="font-mono text-sm">
                        {entry.resource_id
                          ? entry.resource_id.slice(0, 12)
                          : "-"}
                      </td>
                      <td>
                        <span
                          className={`badge ${entry.outcome === "success" ? "badge-healthy" : "badge-unhealthy"}`}
                        >
                          {entry.outcome}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--text-secondary)] max-w-xs truncate">
                        {JSON.stringify(entry.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-[var(--text-secondary)]">
                {total} total entries
              </span>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
