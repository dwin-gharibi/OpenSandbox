"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { proxyUrl } from "@/lib/api";

interface Props {
  sandboxId: string;
  port?: number;
}

interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code?: number;
  running: boolean;
}

export function SandboxTerminal({ sandboxId, port = 44772 }: Props) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const executeCommand = async () => {
    const cmd = command.trim();
    if (!cmd || running) return;

    setRunning(true);
    setCmdHistory((prev) => [cmd, ...prev]);
    setHistIdx(-1);
    setCommand("");

    const entry: CommandResult = { command: cmd, stdout: "", stderr: "", running: true };
    setHistory((prev) => [...prev, entry]);

    try {
      const url = proxyUrl(sandboxId, port, "command");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, timeout: 30, background: false }),
      });

      if (!response.ok) {
        const err = await response.text();
        setHistory((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...entry, stderr: err, running: false };
          return copy;
        });
        setRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let stdout = "";
      let stderr = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "stdout" || data.output_type === "stdout") {
                  stdout += data.data || data.output || "";
                } else if (data.type === "stderr" || data.output_type === "stderr") {
                  stderr += data.data || data.output || "";
                } else if (data.output) {
                  stdout += data.output;
                }
              } catch {
                stdout += line.slice(6);
              }
            }
          }

          setHistory((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { ...entry, stdout, stderr, running: true };
            return copy;
          });
        }
      } else {
        const text = await response.text();
        stdout = text;
      }

      setHistory((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...entry, stdout, stderr, running: false };
        return copy;
      });
    } catch (e: any) {
      setHistory((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...entry, stderr: `Error: ${e.message}`, running: false };
        return copy;
      });
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(next);
      if (cmdHistory[next]) setCommand(cmdHistory[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setCommand(""); }
      else { setHistIdx(next); setCommand(cmdHistory[next]); }
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-[#0d1117] rounded-lg border border-[var(--border)] overflow-hidden font-mono text-sm">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.length === 0 && (
          <div className="text-[#8b949e]">
            Connected to sandbox {sandboxId.slice(0, 12)}... (port {port})
            {"\n"}Type a command and press Enter.
          </div>
        )}
        {history.map((entry, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 text-[#58a6ff]">
              <span className="text-[#8b949e]">$</span>
              <span>{entry.command}</span>
              {entry.running && <Loader2 className="w-3 h-3 animate-spin text-[#8b949e]" />}
            </div>
            {entry.stdout && (
              <pre className="text-[#c9d1d9] whitespace-pre-wrap mt-1 ml-4">{entry.stdout}</pre>
            )}
            {entry.stderr && (
              <pre className="text-[#f85149] whitespace-pre-wrap mt-1 ml-4">{entry.stderr}</pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#30363d] p-3 flex items-center gap-2 bg-[#161b22]">
        <span className="text-[#8b949e]">$</span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={running}
          className="flex-1 bg-transparent border-none outline-none text-[#c9d1d9] placeholder-[#484f58]"
          autoFocus
        />
        <button onClick={executeCommand} disabled={running || !command.trim()}
          className="p-1.5 rounded hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
