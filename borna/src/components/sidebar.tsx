"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  Key,
  ScrollText,
  DollarSign,
  Webhook,
  Shield,
  Activity,
  Gauge,
  LogOut,
  Plus,
  Package,
  FileCode,
} from "lucide-react";
import { clearApiKey, hasApiKey } from "@/lib/api";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sandboxes", label: "Sandboxes", icon: Box },
      { href: "/extensions", label: "Extensions", icon: Package },
      { href: "/provisioning", label: "Provisioning", icon: FileCode },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/api-keys", label: "API Keys", icon: Key },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/audit", label: "Audit Log", icon: ScrollText },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/cost", label: "Cost Tracking", icon: DollarSign },
      { href: "/metrics", label: "Metrics", icon: Activity },
      { href: "/settings", label: "Settings", icon: Gauge },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearApiKey();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col z-50">
      <div className="p-5 border-b border-[var(--border)]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Borna</h1>
            <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">
              OpenSandbox
            </p>
          </div>
        </Link>
      </div>

      <div className="p-3 border-b border-[var(--border)]">
        <Link
          href="/sandboxes/create"
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-light)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Sandbox
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-[var(--accent)] bg-opacity-15 text-[var(--accent-light)] font-medium"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--border)]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-card)] transition-all"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </button>
      </div>
    </aside>
  );
}
