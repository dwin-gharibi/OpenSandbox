"use client";

import { useState } from "react";
import { Play, Loader2, Trash2 } from "lucide-react";
import { proxyUrl } from "@/lib/api";

interface Props {
  sandboxId: string;
  port?: number;
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
  python: 'import sys\nprint(f"Python {sys.version}")\nprint("Hello from sandbox!")\n\nfor i in range(5):\n    print(f"  {i}: {i**2}")',
  javascript: 'console.log(`Node.js ${process.version}`);\nconsole.log("Hello from sandbox!");\n\nfor (let i = 0; i < 5; i++) {\n  console.log(`  ${i}: ${i**2}`);\n}',
  typescript: 'const greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("Sandbox"));',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java sandbox!");\n    }\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go sandbox!")\n}',
  bash: '#!/bin/bash\necho "Hello from Bash!"\necho "Hostname: $(hostname)"\necho "Working dir: $(pwd)"\nls -la /',
};

export function CodeRunner({ sandboxId, port = 44772 }: Props) {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(EXAMPLES.python);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    if (EXAMPLES[lang] && !code.trim()) setCode(EXAMPLES[lang]);
  };

  const runCode = async () => {
    setRunning(true);
    setOutput("");
    setError("");

    try {
      const url = proxyUrl(sandboxId, port, "code");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });

      if (!response.ok) {
        const errText = await response.text();
        setError(errText);
        setRunning(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let out = "";
      let err = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.output_type === "stdout" || data.type === "stdout") {
                  out += data.data || data.output || "";
                } else if (data.output_type === "stderr" || data.type === "stderr") {
                  err += data.data || data.output || "";
                } else if (data.output_type === "result") {
                  out += data.data || "";
                } else if (data.output) {
                  out += data.output;
                }
              } catch {
                out += line.slice(6) + "\n";
              }
            }
          }
          setOutput(out);
          setError(err);
        }
      } else {
        out = await response.text();
      }

      setOutput(out);
      setError(err);
    } catch (e: any) {
      setError(`Connection error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}
          className="min-w-[140px]">
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <button onClick={runCode} disabled={running || !code.trim()}
          className="btn btn-primary">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Running..." : "Run"}
        </button>
        <button onClick={() => { setCode(""); setOutput(""); setError(""); }}
          className="btn btn-ghost">
          <Trash2 className="w-4 h-4" /> Clear
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">Code</p>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-[350px] bg-[#0d1117] text-[#c9d1d9] border border-[var(--border)] rounded-lg p-4 font-mono text-sm resize-none"
            spellCheck={false}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase">Output</p>
          <div className="w-full h-[350px] bg-[#0d1117] border border-[var(--border)] rounded-lg p-4 font-mono text-sm overflow-auto">
            {output && <pre className="text-[#c9d1d9] whitespace-pre-wrap">{output}</pre>}
            {error && <pre className="text-[#f85149] whitespace-pre-wrap">{error}</pre>}
            {!output && !error && !running && (
              <span className="text-[#484f58]">Output will appear here...</span>
            )}
            {running && !output && !error && (
              <span className="text-[#484f58] animate-pulse">Executing...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
