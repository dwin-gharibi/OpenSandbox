"use client";

import { useState } from "react";
import { Play, Loader2, Trash2, AlertCircle } from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
  apiBase?: string;
}

const LANGUAGES = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "bash", label: "Bash" },
];

const EXAMPLES: Record<string, string> = {
  python: 'import sys\nprint(f"Python {sys.version}")\nfor i in range(5):\n    print(f"  {i}: {i**2}")',
  javascript: 'console.log("Node.js " + process.version);\nfor (let i = 0; i < 5; i++) {\n  console.log("  " + i + ": " + i*i);\n}',
  typescript: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Sandbox"));',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}',
  go: 'package main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello from Go!")\n}',
  bash: 'echo "Hello from Bash!"\necho "Hostname: $(hostname)"\necho "PWD: $(pwd)"\nls -la /',
};

export function CodeRunner({ sandboxId, port = 44772, apiBase }: Props) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(EXAMPLES.python);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [connError, setConnError] = useState("");

  const changeLang = (l: string) => {
    setLang(l);
    setCode(EXAMPLES[l] || "");
    setOutput("");
    setError("");
  };

  const runCode = async () => {
    if (!code.trim() || running) return;
    setRunning(true);
    setOutput("");
    setError("");
    setConnError("");

    try {
      const url = `${base}/sandboxes/${sandboxId}/proxy/${port}/code`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: lang }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        setError(text);
        if (res.status === 502 || res.status === 404) {
          setConnError("Cannot reach sandbox code interpreter");
        }
        setRunning(false);
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        if (!reader) { setRunning(false); return; }
        const decoder = new TextDecoder();
        let out = "", err = "";
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const d = JSON.parse(line.slice(6));
              const txt = d.data || d.output || d.text || "";
              if (d.output_type === "stderr" || d.type === "stderr") err += txt;
              else out += txt;
            } catch {
              out += line.slice(6) + "\n";
            }
          }
          setOutput(out);
          setError(err);
        }
        setOutput(out);
        setError(err);
      } else {
        const text = await res.text();
        try {
          const j = JSON.parse(text);
          setOutput(j.stdout || j.output || j.result || text);
          if (j.stderr) setError(j.stderr);
        } catch {
          setOutput(text);
        }
      }
    } catch (e: any) {
      setError(e.message);
      setConnError("Network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {connError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f8514926] text-[#f85149] text-sm">
          <AlertCircle className="w-4 h-4" /> {connError}
        </div>
      )}
      <div className="flex items-center gap-3">
        <select value={lang} onChange={(e) => changeLang(e.target.value)} className="min-w-[140px]">
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button onClick={runCode} disabled={running || !code.trim()} className="btn btn-primary">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running..." : "Run"}
        </button>
        <button onClick={() => { setCode(""); setOutput(""); setError(""); }} className="btn btn-ghost">
          <Trash2 className="w-4 h-4" /> Clear
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">Code</p>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
            className="w-full h-[400px] bg-[#0d1117] text-[#c9d1d9] border border-[var(--border)] rounded-lg p-4 font-mono text-sm resize-none" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">Output</p>
          <div className="w-full h-[400px] bg-[#0d1117] border border-[var(--border)] rounded-lg p-4 font-mono text-sm overflow-auto">
            {output && <pre className="text-[#c9d1d9] whitespace-pre-wrap">{output}</pre>}
            {error && <pre className="text-[#f85149] whitespace-pre-wrap mt-1">{error}</pre>}
            {!output && !error && !running && <span className="text-[#484f58]">Click Run to execute code...</span>}
            {running && !output && !error && <span className="text-[#484f58] animate-pulse">Executing...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
