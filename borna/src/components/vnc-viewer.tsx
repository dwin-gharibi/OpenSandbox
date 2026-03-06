"use client";

import { useState } from "react";
import { Monitor, ExternalLink, Maximize2 } from "lucide-react";

interface Props {
  sandboxId: string;
  endpointHost?: string;
  noVncPort?: number;
}

export function VncViewer({ sandboxId, endpointHost, noVncPort = 6080 }: Props) {
  const [connected, setConnected] = useState(false);
  const [vncUrl, setVncUrl] = useState("");

  const connect = () => {
    const host = endpointHost || window.location.hostname;
    const url = `http://${host}:${noVncPort}/vnc.html?autoconnect=true&resize=scale`;
    setVncUrl(url);
    setConnected(true);
  };

  const proxyConnect = () => {
    const base = process.env.NEXT_PUBLIC_API_URL || "";
    const url = `${base}/sandboxes/${sandboxId}/proxy/${noVncPort}/vnc.html?autoconnect=true&resize=scale`;
    setVncUrl(url);
    setConnected(true);
  };

  if (!connected) {
    return (
      <div className="card text-center py-12 space-y-4">
        <Monitor className="w-16 h-16 mx-auto text-[var(--accent)] opacity-50" />
        <h3 className="text-lg font-semibold">VNC Desktop Viewer</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          Connect to a sandbox running a VNC desktop environment.
          The sandbox must have the VNC Desktop extension installed (noVNC on port {noVncPort}).
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={proxyConnect} className="btn btn-primary">
            <Monitor className="w-4 h-4" /> Connect via Proxy
          </button>
          <button onClick={connect} className="btn btn-ghost">
            <ExternalLink className="w-4 h-4" /> Direct Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">VNC Desktop</p>
        <div className="flex gap-2">
          <a href={vncUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm">
            <Maximize2 className="w-3 h-3" /> Fullscreen
          </a>
          <button onClick={() => setConnected(false)} className="btn btn-ghost text-sm">Disconnect</button>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden border border-[var(--border)]" style={{ height: "600px" }}>
        <iframe
          src={vncUrl}
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
          title="VNC Desktop"
        />
      </div>
    </div>
  );
}
