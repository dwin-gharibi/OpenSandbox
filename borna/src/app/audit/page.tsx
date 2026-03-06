"use client";

import { useEffect, useState } from "react";
import { Search, Filter, Calendar } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { queryAudit, type AuditEntry } from "@/lib/api";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterActor, setFilterActor] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterResource, setFilterResource] = useState("");
  const [filterSince, setFilterSince] = useState("");
  const [filterUntil, setFilterUntil] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const fetchAudit = async () => {
    try {
      const data = await queryAudit({
        actor: filterActor || undefined,
        action: filterAction || undefined,
        resourceId: filterResource || undefined,
        since: filterSince || undefined,
        until: filterUntil || undefined,
        limit,
        offset: page * limit,
      });
      setEntries(data.items);
      setTotal(data.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchAudit(); }, [page, filterActor, filterAction, filterResource, filterSince, filterUntil]);

  const actionColor: Record<string, string> = {
    "sandbox.created": "text-[var(--success)]", "sandbox.deleted": "text-[var(--danger)]",
    "sandbox.paused": "text-[var(--warning)]", "sandbox.resumed": "text-[var(--info)]",
    "sandbox.snapshot.created": "text-[var(--accent)]", "sandbox.cloned": "text-[var(--accent-light)]",
    "sandbox.shared": "text-[var(--info)]",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-[var(--text-secondary)] mt-1">Complete operation trail for compliance and debugging</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <input type="text" placeholder="Actor" value={filterActor} onChange={(e) => { setFilterActor(e.target.value); setPage(0); }} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <input type="text" placeholder="Action" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <input type="text" placeholder="Resource ID" value={filterResource} onChange={(e) => { setFilterResource(e.target.value); setPage(0); }} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <input type="datetime-local" value={filterSince} onChange={(e) => { setFilterSince(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(0); }} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
            <input type="datetime-local" value={filterUntil} onChange={(e) => { setFilterUntil(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(0); }} className="w-full" />
          </div>
        </div>

        <div className="card p-0">
          {loading ? <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div> : entries.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">No audit entries found</div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Details</th></tr></thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="text-[var(--text-secondary)] text-sm whitespace-nowrap">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="font-mono text-sm">{entry.actor || "-"}</td>
                        <td><span className={`font-medium ${actionColor[entry.action] || ""}`}>{entry.action}</span></td>
                        <td className="font-mono text-sm">{entry.resource_id ? entry.resource_id.slice(0, 12) : "-"}</td>
                        <td><span className={`badge ${entry.outcome === "success" ? "badge-healthy" : "badge-unhealthy"}`}>{entry.outcome}</span></td>
                        <td className="text-sm text-[var(--text-secondary)] max-w-[200px] truncate">{JSON.stringify(entry.details)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-[var(--text-secondary)]">{total} total entries</span>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                  <button className="btn btn-ghost" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
