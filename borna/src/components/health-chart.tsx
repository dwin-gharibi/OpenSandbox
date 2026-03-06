"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface HealthChartProps {
  healthy: number;
  unhealthy: number;
  degraded: number;
  unknown: number;
}

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#a1a1aa"];

export function HealthPieChart({
  healthy,
  unhealthy,
  degraded,
  unknown,
}: HealthChartProps) {
  const data = [
    { name: "Healthy", value: healthy },
    { name: "Unhealthy", value: unhealthy },
    { name: "Degraded", value: degraded },
    { name: "Unknown", value: unknown },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-secondary)]">
        No sandboxes
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={4}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              strokeWidth={0}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-primary)",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface ResourceBarChartProps {
  sandboxes: Array<{
    sandbox_id: string;
    cpu_percent: number;
    memory_percent: number;
  }>;
}

export function ResourceBarChart({ sandboxes }: ResourceBarChartProps) {
  const data = sandboxes.slice(0, 10).map((s) => ({
    name: s.sandbox_id.slice(0, 8),
    CPU: s.cpu_percent,
    Memory: s.memory_percent,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-secondary)]">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="name"
          stroke="var(--text-secondary)"
          fontSize={12}
        />
        <YAxis stroke="var(--text-secondary)" fontSize={12} />
        <Tooltip
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text-primary)",
          }}
        />
        <Bar dataKey="CPU" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Memory" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
