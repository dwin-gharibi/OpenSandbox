"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createSandbox } from "@/lib/api";

export default function CreateSandboxPage() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState("python:3.11");
  const [timeout, setTimeout_] = useState(3600);
  const [cpu, setCpu] = useState("500m");
  const [memory, setMemory] = useState("512Mi");
  const [entrypoint, setEntrypoint] = useState("sleep infinity");
  const [envText, setEnvText] = useState("");
  const [metaText, setMetaText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const env: Record<string, string> = {};
      envText.split("\n").filter(Boolean).forEach((line) => {
        const [k, ...v] = line.split("=");
        if (k) env[k.trim()] = v.join("=").trim();
      });

      const metadata: Record<string, string> = {};
      metaText.split("\n").filter(Boolean).forEach((line) => {
        const [k, ...v] = line.split("=");
        if (k) metadata[k.trim()] = v.join("=").trim();
      });

      const result = await createSandbox({
        image: { uri: imageUri },
        timeout,
        resourceLimits: { cpu, memory },
        entrypoint: entrypoint.split(/\s+/).filter(Boolean),
        env: Object.keys(env).length ? env : undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      });

      router.push(`/sandboxes/${result.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/sandboxes" className="btn btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Create Sandbox</h1>
            <p className="text-[var(--text-secondary)] mt-1">Provision a new sandbox from a container image</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Container Image</label>
            <input type="text" value={imageUri} onChange={(e) => setImageUri(e.target.value)} className="w-full" placeholder="python:3.11" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Timeout (seconds)</label>
              <input type="number" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full" min={60} max={86400} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Entrypoint</label>
              <input type="text" value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} className="w-full" placeholder="sleep infinity" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">CPU Limit</label>
              <input type="text" value={cpu} onChange={(e) => setCpu(e.target.value)} className="w-full" placeholder="500m" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Memory Limit</label>
              <input type="text" value={memory} onChange={(e) => setMemory(e.target.value)} className="w-full" placeholder="512Mi" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Environment Variables <span className="text-xs opacity-60">(KEY=VALUE per line)</span></label>
            <textarea value={envText} onChange={(e) => setEnvText(e.target.value)} className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm font-mono" placeholder={"DEBUG=true\nLOG_LEVEL=info"} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Metadata <span className="text-xs opacity-60">(KEY=VALUE per line)</span></label>
            <textarea value={metaText} onChange={(e) => setMetaText(e.target.value)} className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm font-mono" placeholder={"project=myapp\nowner=team"} />
          </div>

          {error && <div className="text-sm text-[var(--danger)] p-3 rounded-lg bg-[var(--danger)] bg-opacity-10">{error}</div>}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center py-3">
            {submitting ? "Creating..." : <><Rocket className="w-4 h-4" /> Create Sandbox</>}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
