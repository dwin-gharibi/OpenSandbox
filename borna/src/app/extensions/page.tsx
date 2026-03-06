"use client";

import { useEffect, useState } from "react";
import {
  Package, Search, Database, Globe, Code, Monitor, Terminal,
  BarChart2, Container, GitBranch, Server,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { listExtensions, getExtensionCategories, type ExtensionInfo } from "@/lib/api";

const iconMap: Record<string, any> = {
  "git-branch": GitBranch, container: Container, database: Database,
  code: Code, "bar-chart": BarChart2, "bar-chart-2": BarChart2,
  monitor: Monitor, globe: Globe, terminal: Terminal,
  "book-open": Code, server: Server,
};

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExtensionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [exts, cats] = await Promise.all([
          listExtensions({ category: selectedCat || undefined, q: search || undefined }),
          getExtensionCategories(),
        ]);
        setExtensions(exts);
        setCategories(cats);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [selectedCat, search]);

  const Icon = ({ name }: { name: string }) => {
    const Comp = iconMap[name] || Package;
    return <Comp className="w-5 h-5" />;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Extensions</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Pre-built tools and services to install in your sandboxes
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-[var(--text-secondary)]" />
            <input type="text" placeholder="Search extensions..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          </div>
          <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
            className="min-w-[160px]">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extensions.map((ext) => (
              <div key={ext.id}
                className={`card cursor-pointer transition-all ${selected?.id === ext.id ? "border-[var(--accent)]" : ""}`}
                onClick={() => setSelected(selected?.id === ext.id ? null : ext)}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent)] bg-opacity-15 flex items-center justify-center text-[var(--accent)]">
                    <Icon name={ext.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{ext.name}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{ext.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ext.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="btn btn-ghost text-sm">Close</button>
            </div>
            <p className="text-[var(--text-secondary)]">{selected.description}</p>

            {selected.packages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Packages</p>
                <div className="flex flex-wrap gap-1">
                  {selected.packages.map((p) => (
                    <code key={p} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-xs">{p}</code>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(selected.env).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Environment Variables</p>
                {Object.entries(selected.env).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm font-mono">
                    <span className="text-[var(--text-secondary)]">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {selected.ports.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Exposed Ports</p>
                <div className="flex gap-2">
                  {selected.ports.map((p) => (
                    <span key={p} className="badge badge-healthy">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(selected.resource_hints).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Recommended Resources</p>
                {Object.entries(selected.resource_hints).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--text-secondary)]">
              Apply this extension from a sandbox&apos;s detail page via the Extensions tab.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
