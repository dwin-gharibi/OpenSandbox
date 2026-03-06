"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Box, Key } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getCostSummary, getSandboxCost, getCostByApiKey, type CostSummary, type SandboxCost, type ApiKeyCost } from "@/lib/api";

export default function CostPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sandboxId, setSandboxId] = useState("");
  const [sandboxCost, setSandboxCost] = useState<SandboxCost | null>(null);
  const [apiKeyVal, setApiKeyVal] = useState("");
  const [apiKeyCost, setApiKeyCost] = useState<ApiKeyCost | null>(null);

  useEffect(() => {
    (async () => {
      try { setSummary(await getCostSummary()); } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const lookupSandbox = async () => {
    if (!sandboxId.trim()) return;
    try { setSandboxCost(await getSandboxCost(sandboxId)); } catch (e: any) { alert(e.message); }
  };

  const lookupApiKey = async () => {
    if (!apiKeyVal.trim()) return;
    try { setApiKeyCost(await getCostByApiKey(apiKeyVal)); } catch (e: any) { alert(e.message); }
  };

  const CostBreakdown = ({ breakdown }: { breakdown: Record<string, number> }) => (
    <div className="space-y-2 mt-4">
      {Object.entries(breakdown).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-lg text-sm">
          <span className="text-[var(--text-secondary)]">{k}</span>
          <span className="font-mono">${v.toFixed(6)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Cost Tracking</h1>
          <p className="text-[var(--text-secondary)] mt-1">Resource consumption per sandbox and per API key</p>
        </div>

        {!loading && summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard title="Total Cost" value={`$${summary.total_cost.toFixed(4)}`} icon={DollarSign} color="warning" />
            <StatCard title="Sandboxes Tracked" value={summary.sandbox_count} icon={Box} color="info" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Sandbox Cost Lookup</h2>
            <div className="flex gap-3">
              <input type="text" placeholder="Sandbox ID" value={sandboxId} onChange={(e) => setSandboxId(e.target.value)} className="flex-1" />
              <button className="btn btn-primary" onClick={lookupSandbox}><TrendingUp className="w-4 h-4" /> Lookup</button>
            </div>
            {sandboxCost && (
              <div className="mt-4">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">Total</span>
                  <span className="text-xl font-bold text-[var(--warning)]">${sandboxCost.total_cost.toFixed(6)}</span>
                </div>
                <CostBreakdown breakdown={sandboxCost.breakdown} />
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">API Key Cost Lookup</h2>
            <div className="flex gap-3">
              <input type="text" placeholder="API Key value" value={apiKeyVal} onChange={(e) => setApiKeyVal(e.target.value)} className="flex-1" />
              <button className="btn btn-primary" onClick={lookupApiKey}><Key className="w-4 h-4" /> Lookup</button>
            </div>
            {apiKeyCost && (
              <div className="mt-4">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <span className="text-[var(--text-secondary)]">{apiKeyCost.api_key}</span>
                  <span className="text-xl font-bold text-[var(--warning)]">${apiKeyCost.total_cost.toFixed(6)}</span>
                </div>
                <CostBreakdown breakdown={apiKeyCost.breakdown} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
