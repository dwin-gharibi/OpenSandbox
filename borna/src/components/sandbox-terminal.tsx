"use client";

import { useRef, useState, useEffect } from "react";
import { Send, Loader2, AlertCircle } from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
  apiBase?: string;
}

interface HistoryEntry {
  command: string;
  output: string;
  error: string;
  done: boolean;
}

export function SandboxTerminal({ sandboxId, port = 44772, apiBase }: Props) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [cmdStack, setCmdStack] = useState<string[]>([]);
  const [stackIdx, setStackIdx] = useState(-1);
  const [connError, setConnError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const run = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    setBusy(true);
    setCmd("");
    setCmdStack((p) => [c, ...p]);
    setStackIdx(-1);
    setConnError("");

    const entry: HistoryEntry = { command: c, output: "", error: "", done: false };
    setHistory((p) => [...p, entry]);
    const idx = history.length;

    const update = (patch: Partial<HistoryEntry>) => {
      setHistory((p) => {
        const copy = [...p];
        copy[idx] = { ...copy[idx], ...patch };
        return copy;
      });
    };

    try {
      const url = `${base}/sandboxes/${sandboxId}/proxy/${port}/command`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: c, timeout: 30, background: false }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        update({ error: text, done: true });
        if (res.status === 502 || res.status === 404) {
          setConnError("Cannot reach sandbox. Is it running?");
        }
        setBusy(false);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) { update({ done: true }); setBusy(false); return; }
        const decoder = new TextDecoder();
        let out = "", err = "";
        let buffer = "";
        while (true) {
          const { done: rDone, value } = await reader.read();
          if (rDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const d = JSON.parse(line.slice(6));
              const txt = d.data || d.output || d.text || "";
              if (d.output_type === "stderr" || d.type === "stderr" || d.stream === "stderr") {
                err += txt;
              } else {
                out += txt;
              }
            } catch {
              out += line.slice(6) + "\n";
            }
          }
          update({ output: out, error: err });
        }
        update({ output: out, error: err, done: true });
      } else {
        const text = await res.text();
        try {
          const j = JSON.parse(text);
          update({ output: j.stdout || j.output || text, error: j.stderr || "", done: true });
        } catch {
          update({ output: text, done: true });
        }
      }
    } catch (e: any) {
      update({ error: e.message, done: true });
      setConnError("Network error connecting to sandbox");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); run(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.min(stackIdx + 1, cmdStack.length - 1); setStackIdx(n); if (cmdStack[n]) setCmd(cmdStack[n]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (stackIdx <= 0) { setStackIdx(-1); setCmd(""); } else { const n = stackIdx - 1; setStackIdx(n); setCmd(cmdStack[n]); } }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#0d1117] rounded-lg border border-[var(--border)] overflow-hidden font-mono text-sm">
      {connError && (
        <div className="px-4 py-2 bg-[#f8514926] text-[#f85149] text-xs flex items-center gap-2">
          <AlertCircle className="w-3 h-3" /> {connError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {history.length === 0 && (
          <div className="text-[#8b949e]">
            sandbox:{sandboxId.slice(0, 8)} (execd port {port}){"\n"}
            Type a command and press Enter.
          </div>
        )}
        {history.map((h, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              <span className="text-[#22c55e]">$</span>
              <span className="text-[#58a6ff]">{h.command}</span>
              {!h.done && <Loader2 className="w-3 h-3 animate-spin text-[#8b949e]" />}
            </div>
            {h.output && <pre className="text-[#c9d1d9] whitespace-pre-wrap ml-4 mt-0.5">{h.output}</pre>}
            {h.error && <pre className="text-[#f85149] whitespace-pre-wrap ml-4 mt-0.5">{h.error}</pre>}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="border-t border-[#30363d] p-3 flex items-center gap-2 bg-[#161b22]">
        <span className="text-[#22c55e]">$</span>
        <input ref={inputRef} type="text" value={cmd} onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKey} placeholder="Enter command..." disabled={busy} autoFocus
          className="flex-1 bg-transparent border-none outline-none text-[#c9d1d9] placeholder-[#484f58]" />
        <button onClick={run} disabled={busy || !cmd.trim()}
          className="p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
