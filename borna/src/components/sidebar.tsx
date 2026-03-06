"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  Key,
  ScrollText,
  DollarSign,
  Webhook,
  Settings,
  Shield,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sandboxes", label: "Sandboxes", icon: Box },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/cost", label: "Cost Tracking", icon: DollarSign },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col z-50">
      <div className="p-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              Borna
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              OpenSandbox Dashboard
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-[var(--accent)] bg-opacity-15 text-[var(--accent-light)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border)]">
        <Link
          href="#"
          onClick={() => {
            const key = prompt("Enter your OpenSandbox API key:");
            if (key) {
              localStorage.setItem("opensandbox_api_key", key);
              window.location.reload();
            }
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
        >
          <Settings className="w-4 h-4" />
          Configure API Key
        </Link>
      </div>
    </aside>
  );
}
