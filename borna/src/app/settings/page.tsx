"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Key, CheckCircle2, AlertCircle, Shield, Trash2, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { setApiKey, clearApiKey, hasApiKey, checkHealth, validateShareToken, type ShareValidation } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [currentKey, setCurrentKey] = useState("");
  const [newKey, setNewKey] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [shareToken, setShareToken] = useState("");
  const [shareResult, setShareResult] = useState<ShareValidation | null>(null);
  const [shareError, setShareError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const key = localStorage.getItem("opensandbox_api_key") || "";
      setCurrentKey(key ? key.slice(0, 12) + "***" : "(not set)");
      setServerUrl(process.env.NEXT_PUBLIC_API_URL || window.location.origin + "/api/proxy");
    }
  }, []);

  const handleUpdateKey = () => {
    if (!newKey.trim()) return;
    setApiKey(newKey.trim());
    setCurrentKey(newKey.trim().slice(0, 12) + "***");
    setNewKey("");
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await checkHealth();
      setTestResult("success");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = () => {
    clearApiKey();
    setCurrentKey("(not set)");
    setTestResult(null);
  };

  const handleValidateShare = async () => {
    if (!shareToken.trim()) return;
    setShareError("");
    setShareResult(null);
    try {
      const result = await validateShareToken(shareToken.trim());
      setShareResult(result);
    } catch (e: any) {
      setShareError(e.message);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-[var(--text-secondary)] mt-1">Authentication and connection configuration</p>
        </div>

        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">API Key</h2>
          </div>

          <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Current Key</p>
              <p className="font-mono text-sm">{currentKey}</p>
            </div>
            {currentKey !== "(not set)" && (
              <button onClick={handleClearKey} className="btn btn-ghost p-1.5" title="Clear">
                <Trash2 className="w-4 h-4 text-[var(--danger)]" />
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <input type="password" placeholder="Enter new API key" value={newKey} onChange={(e) => setNewKey(e.target.value)} className="flex-1" />
            <button onClick={handleUpdateKey} className="btn btn-primary">Save</button>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleTestConnection} disabled={testing} className="btn btn-ghost">
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult === "success" && <span className="flex items-center gap-1 text-sm text-[var(--success)]"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
            {testResult === "error" && <span className="flex items-center gap-1 text-sm text-[var(--danger)]"><AlertCircle className="w-4 h-4" /> Failed</span>}
          </div>
        </div>

        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Server</h2>
          </div>
          <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)]">API Endpoint</p>
            <p className="font-mono text-sm">{serverUrl}</p>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Set via <code>NEXT_PUBLIC_API_URL</code> environment variable.
          </p>
        </div>

        <div className="card space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Validate Share Token</h2>
          </div>
          <div className="flex gap-3">
            <input type="text" placeholder="Paste share token" value={shareToken} onChange={(e) => setShareToken(e.target.value)} className="flex-1" />
            <button onClick={handleValidateShare} className="btn btn-primary">Validate</button>
          </div>
          {shareResult && (
            <div className="p-3 bg-[var(--bg-secondary)] rounded-lg space-y-2">
              <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Sandbox</span><span className="font-mono">{shareResult.sandbox_id.slice(0, 16)}...</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Permissions</span><span>{shareResult.permissions.join(", ")}</span></div>
              <div className="flex justify-between text-sm"><span className="text-[var(--text-secondary)]">Remaining Uses</span><span>{shareResult.remaining_uses ?? "Unlimited"}</span></div>
            </div>
          )}
          {shareError && <p className="text-sm text-[var(--danger)]">{shareError}</p>}
        </div>

        <div className="text-center">
          <button onClick={() => { clearApiKey(); router.push("/login"); }} className="btn btn-ghost text-[var(--danger)]">
            Disconnect and return to login
          </button>
        </div>
      </div>
    </AppShell>
  );
}
