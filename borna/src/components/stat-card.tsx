"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: "default" | "success" | "warning" | "danger" | "info";
}

const colorMap = {
  default: "text-[var(--accent)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  info: "text-[var(--info)]",
};

const bgMap = {
  default: "bg-[var(--accent)]",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  info: "bg-[var(--info)]",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "default",
}: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            {title}
          </p>
          <p className={`stat-value mt-2 ${colorMap[color]}`}>{value}</p>
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg ${bgMap[color]} bg-opacity-15 flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 ${colorMap[color]}`} />
        </div>
      </div>
    </div>
  );
}
