"use client";

import { useRef, useState, useEffect } from "react";
import { Send, Loader2, AlertCircle } from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
}

interface HistoryEntry {
  command: string;
  output: string;
  error: string;
  done: boolean;
}

export function SandboxTerminal({ sandboxId, port = 44772 }: Props) {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [cmdStack, setCmdStack] = useState<string[]>([]);
  const [stackIdx, setStackIdx] = useState(-1);
  const [connError, setConnError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const run = async () => {
    const c = cmd.trim();
    if (!c || busy) return;
    setBusy(true);
    setCmd("");
    setCmdStack((p) => [c, ...p]);
    setStackIdx(-1);
    setConnError("");

    const idx = history.length;
    setHistory((p) => [...p, { command: c, output: "", error: "", done: false }]);

    const update = (patch: Partial<HistoryEntry>) =>
      setHistory((p) => { const copy = [...p]; copy[idx] = { ...copy[idx], ...patch }; return copy; });

    try {
      const res = await fetch(`${base}/sandboxes/${sandboxId}/proxy/${port}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: c, timeout: 30000 }),
      });

      if (!res.ok) {
        update({ error: await res.text().catch(() => `HTTP ${res.status}`), done: true });
        if (res.status >= 500) setConnError("Cannot reach sandbox. Is it running?");
        setBusy(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { update({ done: true }); setBusy(false); return; }

      const decoder = new TextDecoder();
      let out = "", err = "", buffer = "";

      while (true) {
        const { done: eof, value } = await reader.read();
        if (eof) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "stdout" && ev.text) out += ev.text;
            else if (ev.type === "stderr" && ev.text) err += ev.text;
            else if (ev.type === "error" && ev.error) {
              err += `${ev.error.ename || "Error"}: ${ev.error.evalue || ""}\n`;
              if (ev.error.traceback) err += ev.error.traceback.join("\n") + "\n";
            }
          } catch { /* skip malformed lines */ }
        }
        update({ output: out, error: err });
      }
      update({ output: out, error: err, done: true });
    } catch (e: any) {
      update({ error: e.message, done: true });
      setConnError("Network error");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); run(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.min(stackIdx + 1, cmdStack.length - 1);
      setStackIdx(n);
      if (cmdStack[n]) setCmd(cmdStack[n]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (stackIdx <= 0) { setStackIdx(-1); setCmd(""); }
      else { setStackIdx(stackIdx - 1); setCmd(cmdStack[stackIdx - 1]); }
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#0d1117] rounded-lg border border-[var(--border)] overflow-hidden font-mono text-sm">
      {connError && (
        <div className="px-4 py-2 bg-[#f8514926] text-[#f85149] text-xs flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3 h-3" /> {connError}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {history.length === 0 && (
          <div className="text-[#8b949e]">sandbox:{sandboxId.slice(0, 8)} | execd :{port}{"\n"}Type a command and press Enter.</div>
        )}
        {history.map((h, i) => (
          <div key={`cmd-${i}`}>
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
      <div className="border-t border-[#30363d] p-3 flex items-center gap-2 bg-[#161b22] shrink-0">
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
