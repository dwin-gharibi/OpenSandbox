"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Edit3, Save, X, Search, FileCode, Play, Copy, Tag,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  listProvisioningScripts, createProvisioningScript, updateProvisioningScript,
  deleteProvisioningScript, getProvisioningCategories,
  type ProvisioningScriptInfo,
} from "@/lib/api";

export default function ProvisioningPage() {
  const [scripts, setScripts] = useState<ProvisioningScriptInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProvisioningScriptInfo | null>(null);
  const [creating, setCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formScript, setFormScript] = useState("#!/bin/bash\nset -e\n\n");
  const [formCategory, setFormCategory] = useState("general");
  const [formTags, setFormTags] = useState("");
  const [formTimeout, setFormTimeout] = useState(120);
  const [formRunOnCreate, setFormRunOnCreate] = useState(false);
  const [formEnv, setFormEnv] = useState("");

  const fetchAll = async () => {
    try {
      const [s, c] = await Promise.all([
        listProvisioningScripts({ category: filterCat || undefined, q: search || undefined }),
        getProvisioningCategories(),
      ]);
      setScripts(s);
      setCategories(c);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [filterCat, search]);

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormScript("#!/bin/bash\nset -e\n\n");
    setFormCategory("general"); setFormTags(""); setFormTimeout(120);
    setFormRunOnCreate(false); setFormEnv("");
  };

  const startCreate = () => { resetForm(); setEditing(null); setCreating(true); };

  const startEdit = (s: ProvisioningScriptInfo) => {
    setFormName(s.name); setFormDesc(s.description); setFormScript(s.script);
    setFormCategory(s.category); setFormTags(s.tags.join(", "));
    setFormTimeout(s.timeoutSeconds); setFormRunOnCreate(s.runOnCreate);
    setFormEnv(Object.entries(s.env).map(([k, v]) => `${k}=${v}`).join("\n"));
    setEditing(s); setCreating(false);
  };

  const parseEnv = (): Record<string, string> => {
    const out: Record<string, string> = {};
    formEnv.split("\n").filter(Boolean).forEach((l) => {
      const [k, ...v] = l.split("=");
      if (k) out[k.trim()] = v.join("=").trim();
    });
    return out;
  };

  const handleSave = async () => {
    const data = {
      name: formName, description: formDesc, script: formScript,
      category: formCategory, tags: formTags.split(",").map((t) => t.trim()).filter(Boolean),
      env: parseEnv(), timeoutSeconds: formTimeout, runOnCreate: formRunOnCreate,
    };

    try {
      if (editing) {
        await updateProvisioningScript(editing.id, data);
      } else {
        await createProvisioningScript(data);
      }
      setEditing(null); setCreating(false); resetForm(); fetchAll();
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this provisioning script?")) return;
    try { await deleteProvisioningScript(id); fetchAll(); } catch (e: any) { alert(e.message); }
  };

  const handleCopy = (script: ProvisioningScriptInfo) => {
    startCreate();
    setFormName(script.name + " (copy)");
    setFormDesc(script.description);
    setFormScript(script.script);
    setFormCategory(script.category);
    setFormTags(script.tags.join(", "));
    setFormTimeout(script.timeoutSeconds);
    setFormEnv(Object.entries(script.env).map(([k, v]) => `${k}=${v}`).join("\n"));
  };

  const showForm = creating || editing;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Provisioning Scripts</h1>
            <p className="text-[var(--text-secondary)] mt-1">
              Reusable setup scripts to provision sandboxes automatically
            </p>
          </div>
          <button onClick={startCreate} className="btn btn-primary"><Plus className="w-4 h-4" /> New Script</button>
        </div>

        {!showForm && (
          <div className="flex gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-[var(--text-secondary)]" />
              <input type="text" placeholder="Search scripts..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="flex-1" />
            </div>
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="min-w-[150px]">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {showForm && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing ? "Edit Script" : "New Script"}</h3>
              <button onClick={() => { setEditing(null); setCreating(false); resetForm(); }} className="btn btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full" placeholder="My Setup Script" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Category</label>
                <input type="text" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full" placeholder="development" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
              <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full" placeholder="What this script does..." />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Script</label>
              <textarea value={formScript} onChange={(e) => setFormScript(e.target.value)} spellCheck={false}
                className="w-full h-60 bg-[#0d1117] text-[#c9d1d9] border border-[var(--border)] rounded-lg p-4 font-mono text-sm resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Tags <span className="opacity-60">(comma-separated)</span></label>
                <input type="text" value={formTags} onChange={(e) => setFormTags(e.target.value)} className="w-full" placeholder="python, dev" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Timeout (seconds)</label>
                <input type="number" value={formTimeout} onChange={(e) => setFormTimeout(Number(e.target.value))} className="w-full" min={1} max={600} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formRunOnCreate} onChange={(e) => setFormRunOnCreate(e.target.checked)} className="accent-[var(--accent)]" />
                  Run automatically on sandbox creation
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Environment Variables <span className="opacity-60">(KEY=VALUE per line)</span></label>
              <textarea value={formEnv} onChange={(e) => setFormEnv(e.target.value)}
                className="w-full h-16 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm font-mono" placeholder="GIT_REPO_URL=https://..." />
            </div>
            <button onClick={handleSave} className="btn btn-primary"><Save className="w-4 h-4" /> {editing ? "Update" : "Create"}</button>
          </div>
        )}

        {!showForm && (
          <div className="space-y-3">
            {loading ? (
              <div className="card text-center py-8 text-[var(--text-secondary)]">Loading...</div>
            ) : scripts.length === 0 ? (
              <div className="card text-center py-8 text-[var(--text-secondary)]">
                <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No provisioning scripts found</p>
              </div>
            ) : (
              scripts.map((s) => (
                <div key={s.id} className="card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-[var(--accent)]" />
                        <h3 className="font-semibold">{s.name}</h3>
                        {s.runOnCreate && <span className="badge badge-healthy text-[10px]">auto-run</span>}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{s.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-[var(--text-secondary)]">{s.category}</span>
                        {s.tags.length > 0 && (
                          <div className="flex gap-1">
                            {s.tags.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{t}</span>
                            ))}
                          </div>
                        )}
                        <span className="text-xs text-[var(--text-secondary)]">timeout: {s.timeoutSeconds}s</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-4">
                      <button onClick={() => startEdit(s)} className="btn btn-ghost p-1.5" title="Edit"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleCopy(s)} className="btn btn-ghost p-1.5" title="Duplicate"><Copy className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="btn btn-ghost p-1.5" title="Delete"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button>
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">View script</summary>
                    <pre className="text-xs bg-[#0d1117] text-[#c9d1d9] p-3 rounded-lg mt-2 font-mono overflow-x-auto max-h-40">{s.script}</pre>
                  </details>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
