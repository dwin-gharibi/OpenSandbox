"use client";

import { useEffect, useState, useRef } from "react";
import {
  Folder, File, ArrowLeft, RefreshCw, Download, Upload, Trash2,
  FolderPlus, ChevronRight, AlertCircle, FileText, Eye,
} from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
}

interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  modifiedAt?: string;
}

export function FileBrowser({ sandboxId, port = 44772 }: Props) {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const proxy = `${base}/sandboxes/${sandboxId}/proxy/${port}`;

  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const fetchDir = async (path: string) => {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const res = await fetch(
        `${proxy}/files/search?path=${encodeURIComponent(path)}&pattern=*`
      );
      if (!res.ok) {
        setError(await res.text().catch(() => `HTTP ${res.status}`));
        setEntries([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const items: any[] = Array.isArray(data) ? data : [];

      const mapped: FileEntry[] = items.map((f: any) => {
        const fullPath = f.path || "";
        const name = fullPath.split("/").filter(Boolean).pop() || fullPath;
        const isDir = f.mode !== undefined ? (f.mode & 0o40000) !== 0 : !!f.is_dir;
        return {
          path: fullPath,
          name,
          isDir,
          size: f.size || 0,
          modifiedAt: f.modified_at,
        };
      }).filter((f) => f.path !== path);

      mapped.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(mapped);
      setCwd(path);
    } catch (e: any) {
      setError(e.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDir(cwd); }, []);

  const navigate = (path: string) => fetchDir(path);

  const goBack = () => {
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    navigate("/" + parts.join("/") || "/");
  };

  const handleDownload = async (filePath: string, name: string) => {
    try {
      const res = await fetch(`${proxy}/files/download?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(`Download error: ${e.message}`); }
  };

  const handlePreview = async (filePath: string, name: string) => {
    try {
      const res = await fetch(`${proxy}/files/download?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) { alert("Cannot preview"); return; }
      const text = await res.text();
      setPreview({ name, content: text.slice(0, 50000) });
    } catch (e: any) { alert(`Preview error: ${e.message}`); }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const targetPath = cwd === "/" ? `/${file.name}` : `${cwd}/${file.name}`;
        const metaJson = JSON.stringify({ path: targetPath, mode: 644 });
        const metaBlob = new Blob([metaJson], { type: "application/json" });
        const formData = new FormData();
        formData.append("metadata", metaBlob, "metadata.json");
        formData.append("file", file, file.name);
        const res = await fetch(`${proxy}/files/upload`, { method: "POST", body: formData });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          alert(`Upload failed for ${file.name}: ${text}`);
        }
      }
      fetchDir(cwd);
    } catch (e: any) { alert(`Upload error: ${e.message}`); }
  };

  const handleDelete = async (filePath: string, isDir: boolean) => {
    if (!confirm(`Delete ${filePath}?`)) return;
    try {
      const endpoint = isDir ? "directories" : "files";
      const res = await fetch(`${proxy}/${endpoint}?path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
      if (!res.ok) alert("Delete failed: " + await res.text().catch(() => ""));
      fetchDir(cwd);
    } catch (e: any) { alert(`Delete error: ${e.message}`); }
  };

  const handleCreateDir = async () => {
    const name = prompt("Directory name:");
    if (!name) return;
    const fullPath = cwd === "/" ? `/${name}` : `${cwd}/${name}`;
    try {
      await fetch(`${proxy}/directories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fullPath]: { mode: 755 } }),
      });
      fetchDir(cwd);
    } catch (e: any) { alert(`Error: ${e.message}`); }
  };

  const formatSize = (bytes: number): string => {
    if (bytes <= 0) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(1)} GB`;
  };

  const breadcrumbs = cwd.split("/").filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm overflow-x-auto">
          <button onClick={goBack} disabled={cwd === "/"} className="btn btn-ghost p-1.5 disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate("/")} className="text-[var(--accent)] hover:underline px-1">/</button>
          {breadcrumbs.map((part, i) => {
            const path = "/" + breadcrumbs.slice(0, i + 1).join("/");
            return (
              <span key={`bc-${i}`} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
                <button onClick={() => navigate(path)} className="text-[var(--accent)] hover:underline">{part}</button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleCreateDir} className="btn btn-ghost text-sm"><FolderPlus className="w-4 h-4" /></button>
          <button onClick={() => uploadRef.current?.click()} className="btn btn-ghost text-sm"><Upload className="w-4 h-4" /></button>
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
            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--accent)]" /><h3 className="font-semibold text-sm">{preview.name}</h3></div>
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
              <thead><tr><th>Name</th><th>Size</th><th>Modified</th><th>Actions</th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={`file-${entry.path}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        {entry.isDir
                          ? <Folder className="w-4 h-4 text-[var(--accent)]" />
                          : <File className="w-4 h-4 text-[var(--text-secondary)]" />}
                        {entry.isDir ? (
                          <button onClick={() => navigate(entry.path)} className="text-[var(--accent)] hover:underline text-sm">{entry.name}</button>
                        ) : (
                          <span className="text-sm">{entry.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-[var(--text-secondary)] text-sm">{entry.isDir ? "-" : formatSize(entry.size)}</td>
                    <td className="text-[var(--text-secondary)] text-sm">{entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : "-"}</td>
                    <td>
                      <div className="flex gap-1">
                        {!entry.isDir && (
                          <>
                            <button onClick={() => handlePreview(entry.path, entry.name)} className="btn btn-ghost p-1" title="Preview"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDownload(entry.path, entry.name)} className="btn btn-ghost p-1" title="Download"><Download className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button onClick={() => handleDelete(entry.path, entry.isDir)} className="btn btn-ghost p-1" title="Delete"><Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
