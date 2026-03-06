"use client";

import { useEffect, useState, useRef } from "react";
import {
  Folder, File, ArrowLeft, RefreshCw, Download, Upload, Trash2,
  FolderPlus, ChevronRight, AlertCircle, FileText, Eye,
} from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
  apiBase?: string;
}

interface FileInfo {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mod_time?: string;
  permissions?: string;
}

export function FileBrowser({ sandboxId, port = 44772, apiBase }: Props) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const proxyBase = `${base}/sandboxes/${sandboxId}/proxy/${port}`;

  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>(["/"]);
  const uploadRef = useRef<HTMLInputElement>(null);

  const fetchDir = async (path: string) => {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(`${proxyBase}/files/info?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        setError(text);
        setEntries([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const items: FileInfo[] = Array.isArray(data) ? data
        : data.entries ? data.entries
        : data.children ? data.children
        : [data];

      const sorted = items.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });
      setEntries(sorted);
      setCwd(path);
    } catch (e: any) {
      setError(e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDir(cwd); }, []);

  const navigate = (path: string) => {
    setPathHistory((prev) => [...prev, path]);
    fetchDir(path);
  };

  const goBack = () => {
    const parent = cwd.split("/").slice(0, -1).join("/") || "/";
    navigate(parent);
  };

  const handleDownload = async (path: string, name: string) => {
    try {
      const res = await fetch(`${proxyBase}/files/download?path=${encodeURIComponent(path)}`);
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Download error: ${e.message}`);
    }
  };

  const handlePreview = async (path: string, name: string) => {
    try {
      const res = await fetch(`${proxyBase}/files/download?path=${encodeURIComponent(path)}`);
      if (!res.ok) { alert("Cannot preview file"); return; }
      const text = await res.text();
      setPreview({ name, content: text.slice(0, 50000) });
    } catch (e: any) {
      alert(`Preview error: ${e.message}`);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const formData = new FormData();
      formData.append("path", cwd);
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch(`${proxyBase}/files/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) { alert("Upload failed"); return; }
      fetchDir(cwd);
    } catch (e: any) {
      alert(`Upload error: ${e.message}`);
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Delete ${path}?`)) return;
    try {
      const res = await fetch(`${proxyBase}/files?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      if (!res.ok) { alert("Delete failed"); return; }
      fetchDir(cwd);
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleCreateDir = async () => {
    const name = prompt("Directory name:");
    if (!name) return;
    const fullPath = cwd === "/" ? `/${name}` : `${cwd}/${name}`;
    try {
      const res = await fetch(`${proxyBase}/directories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: fullPath }),
      });
      if (!res.ok) { alert("Create directory failed"); return; }
      fetchDir(cwd);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  };

  const breadcrumbs = cwd.split("/").filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={goBack} disabled={cwd === "/"} className="btn btn-ghost p-1.5 disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/")} className="text-[var(--accent)] hover:underline">/</button>
          {breadcrumbs.map((part, i) => {
            const path = "/" + breadcrumbs.slice(0, i + 1).join("/");
            return (
              <span key={path} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
                <button onClick={() => navigate(path)} className="text-[var(--accent)] hover:underline">{part}</button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={handleCreateDir} className="btn btn-ghost text-sm"><FolderPlus className="w-4 h-4" /> New Dir</button>
          <button onClick={() => uploadRef.current?.click()} className="btn btn-ghost text-sm"><Upload className="w-4 h-4" /> Upload</button>
          <button onClick={() => fetchDir(cwd)} className="btn btn-ghost p-1.5"><RefreshCw className="w-4 h-4" /></button>
          <input ref={uploadRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f8514926] text-[#f85149] text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {preview && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="font-semibold text-sm">{preview.name}</h3>
            </div>
            <button onClick={() => setPreview(null)} className="btn btn-ghost text-xs">Close</button>
          </div>
          <pre className="text-xs bg-[#0d1117] text-[#c9d1d9] p-4 rounded-lg overflow-auto max-h-80 font-mono">{preview.content}</pre>
        </div>
      )}

      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">Empty directory</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Name</th><th>Size</th><th>Modified</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const fullPath = cwd === "/" ? `/${entry.name}` : `${cwd}/${entry.name}`;
                  return (
                    <tr key={entry.name || entry.path}>
                      <td>
                        <div className="flex items-center gap-2">
                          {entry.is_dir
                            ? <Folder className="w-4 h-4 text-[var(--accent)]" />
                            : <File className="w-4 h-4 text-[var(--text-secondary)]" />
                          }
                          {entry.is_dir ? (
                            <button onClick={() => navigate(fullPath)}
                              className="text-[var(--accent)] hover:underline text-sm">{entry.name}</button>
                          ) : (
                            <span className="text-sm">{entry.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">{entry.is_dir ? "-" : formatSize(entry.size)}</td>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {entry.mod_time ? new Date(entry.mod_time).toLocaleString() : "-"}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {!entry.is_dir && (
                            <>
                              <button onClick={() => handlePreview(fullPath, entry.name)}
                                className="btn btn-ghost p-1" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDownload(fullPath, entry.name)}
                                className="btn btn-ghost p-1" title="Download"><Download className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          <button onClick={() => handleDelete(fullPath)}
                            className="btn btn-ghost p-1" title="Delete"><Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
