"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Heart,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Cpu,
  MemoryStick,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { HealthPieChart, ResourceBarChart } from "@/components/health-chart";
import { getDashboard, getRateLimit, type DashboardData, type RateLimitInfo } from "@/lib/api";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dash, rl] = await Promise.all([getDashboard(), getRateLimit().catch(() => null)]);
        setData(dash);
        setRateLimit(rl);
        setError("");
      } catch (e: any) {
        setError(e.message || "Failed to fetch dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-[var(--text-secondary)] mt-1">Real-time health monitoring</p>
          </div>
          {rateLimit && (
            <div className="text-xs text-[var(--text-secondary)] text-right">
              <div>Rate: {rateLimit.limits.minute_remaining}/min remaining</div>
              <div>{rateLimit.limits.hour_remaining}/hr remaining</div>
            </div>
          )}
        </div>

        {error && !data && (
          <div className="card border-[var(--danger)]">
            <div className="flex items-center gap-3 text-[var(--danger)]">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Connection Error</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-[var(--text-secondary)]">Loading...</div>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Sandboxes" value={data.total_sandboxes} icon={Box} color="info" />
              <StatCard title="Healthy" value={data.healthy} icon={Heart} color="success" />
              <StatCard title="Unhealthy" value={data.unhealthy} icon={XCircle} color="danger" />
              <StatCard title="Degraded" value={data.degraded} icon={AlertTriangle} color="warning" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Avg Response" value={`${data.avg_response_time_ms}ms`} icon={Zap} />
              <StatCard title="Avg CPU" value={`${data.avg_cpu_percent}%`} icon={Cpu} />
              <StatCard title="Avg Memory" value={`${data.avg_memory_percent}%`} icon={MemoryStick} />
              <StatCard title="Uptime" value={formatUptime(data.uptime_seconds)} subtitle={`${data.requests_per_minute} req/min`} icon={Clock} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Health Distribution</h2>
                <HealthPieChart healthy={data.healthy} unhealthy={data.unhealthy} degraded={data.degraded} unknown={data.unknown} />
                <div className="flex justify-center gap-6 mt-4">
                  {[{ label: "Healthy", color: "#22c55e" }, { label: "Unhealthy", color: "#ef4444" }, { label: "Degraded", color: "#f59e0b" }, { label: "Unknown", color: "#a1a1aa" }].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                      <span className="text-[var(--text-secondary)]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Resource Usage</h2>
                <ResourceBarChart sandboxes={data.sandboxes} />
              </div>
            </div>

            {data.sandboxes.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Sandbox Health Status</h2>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Sandbox ID</th><th>Status</th><th>Response Time</th><th>CPU</th><th>Memory</th><th>Last Check</th></tr>
                    </thead>
                    <tbody>
                      {data.sandboxes.map((s) => (
                        <tr key={s.sandbox_id}>
                          <td className="font-mono text-sm">{s.sandbox_id.slice(0, 12)}...</td>
                          <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                          <td>{s.response_time_ms}ms</td>
                          <td>{s.cpu_percent}%</td>
                          <td>{s.memory_percent}%</td>
                          <td className="text-[var(--text-secondary)]">{new Date(s.last_check).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
