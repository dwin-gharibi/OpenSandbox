"use client";

import { useState } from "react";
import { Monitor, ExternalLink, Maximize2, AlertCircle } from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
  apiBase?: string;
}

export function VncViewer({ sandboxId, port = 6080, apiBase }: Props) {
  const base = apiBase || process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const [connected, setConnected] = useState(false);
  const [vncUrl, setVncUrl] = useState("");
  const [customPort, setCustomPort] = useState(String(port));
  const [loadError, setLoadError] = useState(false);

  const connect = () => {
    const p = Number(customPort) || port;
    const url = `${base}/sandboxes/${sandboxId}/proxy/${p}/vnc.html?autoconnect=true&resize=scale`;
    setVncUrl(url);
    setConnected(true);
    setLoadError(false);
  };

  if (!connected) {
    return (
      <div className="card text-center py-12 space-y-4">
        <Monitor className="w-16 h-16 mx-auto text-[var(--accent)] opacity-40" />
        <h3 className="text-lg font-semibold">VNC Desktop Viewer</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
          Connect to a graphical desktop running inside the sandbox.
          The sandbox must have a VNC server and noVNC/websockify installed
          (use the &quot;VNC Desktop&quot; extension).
        </p>
        <div className="flex items-center justify-center gap-3">
          <label className="text-sm text-[var(--text-secondary)]">noVNC Port:</label>
          <input type="number" value={customPort} onChange={(e) => setCustomPort(e.target.value)}
            className="w-24 text-center" />
          <button onClick={connect} className="btn btn-primary">
            <Monitor className="w-4 h-4" /> Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">VNC Desktop — port {customPort}</p>
        <div className="flex gap-2">
          <a href={vncUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
            <Maximize2 className="w-3 h-3" /> Fullscreen
          </a>
          <button onClick={() => { setConnected(false); setLoadError(false); }} className="btn btn-ghost text-sm">
            Disconnect
          </button>
        </div>
      </div>
      {loadError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f8514926] text-[#f85149] text-sm">
          <AlertCircle className="w-4 h-4" />
          Could not load VNC viewer. Ensure the sandbox has noVNC running on port {customPort}.
        </div>
      )}
      <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-black" style={{ height: "600px" }}>
        <iframe
          src={vncUrl}
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          title="VNC Desktop"
          onError={() => setLoadError(true)}
        />
      </div>
    </div>
  );
}
