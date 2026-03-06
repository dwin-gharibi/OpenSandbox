"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createSandbox, type NetworkRule, type Volume } from "@/lib/api";

export default function CreateSandboxPage() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState("python:3.11");
  const [useAuth, setUseAuth] = useState(false);
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [timeout, setTimeout_] = useState(3600);
  const [cpu, setCpu] = useState("500m");
  const [memory, setMemory] = useState("512Mi");
  const [gpu, setGpu] = useState("");
  const [entrypoint, setEntrypoint] = useState("sleep infinity");
  const [envText, setEnvText] = useState("");
  const [metaText, setMetaText] = useState("");

  const [showNetwork, setShowNetwork] = useState(false);
  const [netDefault, setNetDefault] = useState("allow");
  const [egressRules, setEgressRules] = useState<NetworkRule[]>([]);

  const [showVolumes, setShowVolumes] = useState(false);
  const [volumes, setVolumes] = useState<{ name: string; type: string; path: string; mountPath: string; readOnly: boolean }[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const addEgressRule = () => setEgressRules([...egressRules, { action: "allow", target: "" }]);
  const removeEgressRule = (i: number) => setEgressRules(egressRules.filter((_, idx) => idx !== i));
  const updateEgressRule = (i: number, field: string, value: string) => {
    const copy = [...egressRules];
    (copy[i] as any)[field] = value;
    setEgressRules(copy);
  };

  const addVolume = () => setVolumes([...volumes, { name: "", type: "host", path: "", mountPath: "", readOnly: false }]);
  const removeVolume = (i: number) => setVolumes(volumes.filter((_, idx) => idx !== i));
  const updateVolume = (i: number, field: string, value: any) => {
    const copy = [...volumes];
    (copy[i] as any)[field] = value;
    setVolumes(copy);
  };

  const parseKV = (text: string): Record<string, string> => {
    const out: Record<string, string> = {};
    text.split("\n").filter(Boolean).forEach((line) => {
      const [k, ...v] = line.split("=");
      if (k) out[k.trim()] = v.join("=").trim();
    });
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const env = parseKV(envText);
      const metadata = parseKV(metaText);
      const resources: Record<string, string> = { cpu, memory };
      if (gpu) resources.gpu = gpu;

      const networkPolicy = showNetwork && (egressRules.length > 0 || netDefault)
        ? { defaultAction: netDefault, egress: egressRules.filter((r) => r.target) }
        : undefined;

      const volumeList: Volume[] | undefined = showVolumes && volumes.length > 0
        ? volumes.filter((v) => v.name && v.mountPath).map((v) => ({
            name: v.name,
            ...(v.type === "host" ? { host: { path: v.path } } : { pvc: { claimName: v.path } }),
            mountPath: v.mountPath,
            readOnly: v.readOnly,
          }))
        : undefined;

      const result = await createSandbox({
        image: {
          uri: imageUri,
          ...(useAuth && authUser ? { auth: { username: authUser, password: authPass } } : {}),
        },
        timeout,
        resourceLimits: resources,
        entrypoint: entrypoint.split(/\s+/).filter(Boolean),
        env: Object.keys(env).length ? env : undefined,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        networkPolicy,
        volumes: volumeList,
      });
      router.push(`/sandboxes/${result.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const SectionToggle = ({ label, open, toggle }: { label: string; open: boolean; toggle: () => void }) => (
    <button type="button" onClick={toggle} className="flex items-center justify-between w-full py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
      {label}
      {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/sandboxes" className="btn btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold">Create Sandbox</h1>
            <p className="text-[var(--text-secondary)] mt-1">Provision a new sandbox from a container image</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold">Image</h3>
            <input type="text" value={imageUri} onChange={(e) => setImageUri(e.target.value)} className="w-full" placeholder="python:3.11" required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useAuth} onChange={(e) => setUseAuth(e.target.checked)} className="accent-[var(--accent)]" />
              Private registry (requires auth)
            </label>
            {useAuth && (
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Username" value={authUser} onChange={(e) => setAuthUser(e.target.value)} />
                <input type="password" placeholder="Password / Token" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold">Resources & Runtime</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Timeout (seconds)</label>
                <input type="number" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full" min={60} max={86400} required />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Entrypoint</label>
                <input type="text" value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} className="w-full" placeholder="sleep infinity" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">CPU</label>
                <input type="text" value={cpu} onChange={(e) => setCpu(e.target.value)} className="w-full" placeholder="500m" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Memory</label>
                <input type="text" value={memory} onChange={(e) => setMemory(e.target.value)} className="w-full" placeholder="512Mi" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">GPU</label>
                <input type="text" value={gpu} onChange={(e) => setGpu(e.target.value)} className="w-full" placeholder="0 (optional)" />
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold">Environment & Metadata</h3>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Environment Variables <span className="opacity-60">(KEY=VALUE per line)</span></label>
              <textarea value={envText} onChange={(e) => setEnvText(e.target.value)} className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm font-mono" placeholder={"DEBUG=true\nLOG_LEVEL=info"} />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Metadata <span className="opacity-60">(KEY=VALUE per line)</span></label>
              <textarea value={metaText} onChange={(e) => setMetaText(e.target.value)} className="w-full h-20 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-sm font-mono" placeholder={"project=myapp\nowner=team"} />
            </div>
          </div>

          <div className="card space-y-3">
            <SectionToggle label="Network Policy (egress)" open={showNetwork} toggle={() => setShowNetwork(!showNetwork)} />
            {showNetwork && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">Default Action</label>
                  <select value={netDefault} onChange={(e) => setNetDefault(e.target.value)} className="w-full">
                    <option value="allow">Allow</option>
                    <option value="deny">Deny</option>
                  </select>
                </div>
                {egressRules.map((rule, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={rule.action} onChange={(e) => updateEgressRule(i, "action", e.target.value)} className="w-24">
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                    <input type="text" placeholder="*.example.com" value={rule.target} onChange={(e) => updateEgressRule(i, "target", e.target.value)} className="flex-1" />
                    <button type="button" onClick={() => removeEgressRule(i)} className="btn btn-ghost p-1.5"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button>
                  </div>
                ))}
                <button type="button" onClick={addEgressRule} className="btn btn-ghost text-sm"><Plus className="w-3 h-3" /> Add Rule</button>
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <SectionToggle label="Volumes" open={showVolumes} toggle={() => setShowVolumes(!showVolumes)} />
            {showVolumes && (
              <div className="space-y-3">
                {volumes.map((vol, i) => (
                  <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Volume name" value={vol.name} onChange={(e) => updateVolume(i, "name", e.target.value)} className="flex-1" />
                      <select value={vol.type} onChange={(e) => updateVolume(i, "type", e.target.value)} className="w-24">
                        <option value="host">Host</option>
                        <option value="pvc">PVC</option>
                      </select>
                      <button type="button" onClick={() => removeVolume(i)} className="btn btn-ghost p-1.5"><Trash2 className="w-4 h-4 text-[var(--danger)]" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder={vol.type === "host" ? "Host path" : "PVC claim name"} value={vol.path} onChange={(e) => updateVolume(i, "path", e.target.value)} />
                      <input type="text" placeholder="Mount path (/data)" value={vol.mountPath} onChange={(e) => updateVolume(i, "mountPath", e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <input type="checkbox" checked={vol.readOnly} onChange={(e) => updateVolume(i, "readOnly", e.target.checked)} className="accent-[var(--accent)]" />
                      Read-only
                    </label>
                  </div>
                ))}
                <button type="button" onClick={addVolume} className="btn btn-ghost text-sm"><Plus className="w-3 h-3" /> Add Volume</button>
              </div>
            )}
          </div>

          {error && <div className="text-sm text-[var(--danger)] p-3 rounded-lg bg-[var(--danger)] bg-opacity-10 card">{error}</div>}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center py-3">
            {submitting ? "Creating..." : <><Rocket className="w-4 h-4" /> Create Sandbox</>}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
