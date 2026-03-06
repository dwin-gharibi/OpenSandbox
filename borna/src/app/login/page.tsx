"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { setApiKey, checkHealth } from "@/lib/api";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError("Please enter an API key");
      return;
    }

    setTesting(true);
    setError("");
    setApiKey(key.trim());

    try {
      await checkHealth();
      setSuccess(true);
      setTimeout(() => router.push("/"), 500);
    } catch {
      setSuccess(false);
      setError("Could not connect to server. Key saved — you can still proceed.");
      setTimeout(() => router.push("/"), 1500);
    } finally {
      setTesting(false);
    }
  };

  const handleSkip = () => {
    router.push("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)] mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Borna</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            OpenSandbox Health Monitoring Dashboard
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                API Key
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your OPEN-SANDBOX-API-KEY"
                className="w-full px-4 py-3 text-base"
                autoFocus
              />
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                The key from your server&apos;s config.toml or the admin API.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--warning)] bg-opacity-10 text-[var(--warning)] text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--success)] bg-opacity-10 text-[var(--success)] text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected! Redirecting...</span>
              </div>
            )}

            <button
              type="submit"
              disabled={testing}
              className="btn btn-primary w-full justify-center py-3 text-base"
            >
              {testing ? "Connecting..." : "Connect"}
              {!testing && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="btn btn-ghost w-full justify-center"
            >
              Skip (no auth)
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--text-secondary)] mt-6">
          Your API key is stored locally in your browser.
        </p>
      </div>
    </div>
  );
}
