"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getPrometheusMetrics, getRateLimit, type RateLimitInfo } from "@/lib/api";

interface ParsedMetric {
  name: string;
  help: string;
  type: string;
  values: { labels: string; value: string }[];
}

function parsePrometheusText(text: string): ParsedMetric[] {
  const metrics: ParsedMetric[] = [];
  let current: ParsedMetric | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("# HELP ")) {
      const rest = line.slice(7);
      const idx = rest.indexOf(" ");
      const name = rest.slice(0, idx);
      const help = rest.slice(idx + 1);
      current = { name, help, type: "", values: [] };
      metrics.push(current);
    } else if (line.startsWith("# TYPE ") && current) {
      current.type = line.split(" ").pop() || "";
    } else if (line && !line.startsWith("#") && current) {
      const match = line.match(/^([^\s{]+)(\{[^}]*\})?\s+(.+)$/);
      if (match) {
        current.values.push({ labels: match[2] || "", value: match[3] });
      }
    }
  }
  return metrics;
}

export default function MetricsPage() {
  const [raw, setRaw] = useState("");
  const [metrics, setMetrics] = useState<ParsedMetric[]>([]);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const fetchMetrics = async () => {
    try {
      const [text, rl] = await Promise.all([
        getPrometheusMetrics(),
        getRateLimit().catch(() => null),
      ]);
      setRaw(text);
      setMetrics(parsePrometheusText(text));
      setRateLimit(rl);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const typeColor: Record<string, string> = {
    counter: "text-[var(--success)]", gauge: "text-[var(--info)]",
    histogram: "text-[var(--accent)]", info: "text-[var(--warning)]",
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Metrics</h1>
            <p className="text-[var(--text-secondary)] mt-1">Prometheus metrics and rate limit status</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowRaw(!showRaw)} className="btn btn-ghost">{showRaw ? "Parsed View" : "Raw View"}</button>
            <button onClick={fetchMetrics} className="btn btn-ghost"><RefreshCw className="w-4 h-4" /></button>
          </div>
        </div>

        {rateLimit && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Rate Limit Status</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Per Minute", value: rateLimit.limits.minute_remaining },
                { label: "Per Hour", value: rateLimit.limits.hour_remaining },
                { label: "Creates/Hour", value: rateLimit.limits.create_remaining },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-[var(--bg-secondary)] rounded-lg text-center">
                  <p className="text-2xl font-bold text-[var(--accent)]">{item.value}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{item.label} remaining</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-[var(--text-secondary)] py-8">Loading metrics...</div>
        ) : showRaw ? (
          <div className="card">
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-[600px] text-[var(--text-secondary)]">{raw}</pre>
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.filter((m) => m.values.length > 0).map((m) => (
              <div key={m.name} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-mono text-sm font-semibold">{m.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{m.help}</p>
                  </div>
                  <span className={`badge ${m.type === "counter" ? "badge-healthy" : m.type === "gauge" ? "badge-degraded" : "badge-unknown"}`}>
                    {m.type}
                  </span>
                </div>
                <div className="space-y-1">
                  {m.values.slice(0, 20).map((v, i) => (
                    <div key={i} className="flex justify-between text-sm font-mono">
                      <span className="text-[var(--text-secondary)] truncate max-w-[70%]">{v.labels || "(no labels)"}</span>
                      <span className="font-semibold">{v.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
