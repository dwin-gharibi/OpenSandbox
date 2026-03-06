"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Box } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { apiFetch, type CostSummary } from "@/lib/api";

export default function CostPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [sandboxId, setSandboxId] = useState("");
  const [sandboxCost, setSandboxCost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await apiFetch<CostSummary>("/admin/cost/summary");
        setSummary(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const lookupSandboxCost = async () => {
    if (!sandboxId.trim()) return;
    try {
      const data = await apiFetch(`/sandboxes/${sandboxId}/cost`);
      setSandboxCost(data);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Cost Tracking</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Monitor resource consumption and costs across sandboxes
        </p>
      </div>

      {loading ? (
        <p className="text-[var(--text-secondary)]">Loading...</p>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Total Cost"
            value={`$${summary.total_cost.toFixed(4)}`}
            icon={DollarSign}
            color="warning"
          />
          <StatCard
            title="Sandboxes Tracked"
            value={summary.sandbox_count}
            icon={Box}
            color="info"
          />
        </div>
      ) : null}

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Sandbox Cost Lookup</h2>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter sandbox ID..."
            value={sandboxId}
            onChange={(e) => setSandboxId(e.target.value)}
            className="flex-1"
          />
          <button className="btn btn-primary" onClick={lookupSandboxCost}>
            <TrendingUp className="w-4 h-4" />
            Lookup
          </button>
        </div>

        {sandboxCost && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
              <span className="text-[var(--text-secondary)]">Total Cost</span>
              <span className="text-xl font-bold text-[var(--warning)]">
                ${sandboxCost.total_cost.toFixed(6)}
              </span>
            </div>
            {sandboxCost.breakdown &&
              Object.entries(sandboxCost.breakdown).map(
                ([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg"
                  >
                    <span className="text-[var(--text-secondary)]">{key}</span>
                    <span className="font-mono">${value.toFixed(6)}</span>
                  </div>
                )
              )}
          </div>
        )}
      </div>
    </div>
  );
}
