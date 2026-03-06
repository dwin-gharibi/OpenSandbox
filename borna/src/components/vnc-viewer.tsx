"use client";

import { useState } from "react";
import { Monitor, Maximize2, AlertCircle, Info } from "lucide-react";

interface Props {
  sandboxId: string;
  port?: number;
}

export function VncViewer({ sandboxId, port = 6080 }: Props) {
  const base = process.env.NEXT_PUBLIC_API_URL || "/api/proxy";
  const [connected, setConnected] = useState(false);
  const [vncUrl, setVncUrl] = useState("");
  const [customPort, setCustomPort] = useState(String(port));

  const connect = () => {
    const p = Number(customPort) || port;
    setVncUrl(`${base}/sandboxes/${sandboxId}/proxy/${p}/vnc.html?autoconnect=true&resize=scale`);
    setConnected(true);
  };

  if (!connected) {
    return (
      <div className="space-y-4">
        <div className="card text-center py-12 space-y-4">
          <Monitor className="w-16 h-16 mx-auto text-[var(--accent)] opacity-40" />
          <h3 className="text-lg font-semibold">VNC Desktop Viewer</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
            Connect to a graphical desktop running inside the sandbox.
          </p>
          <div className="flex items-center justify-center gap-3">
            <label className="text-sm text-[var(--text-secondary)]">noVNC Port:</label>
            <input type="number" value={customPort} onChange={(e) => setCustomPort(e.target.value)} className="w-24 text-center" />
            <button onClick={connect} className="btn btn-primary"><Monitor className="w-4 h-4" /> Connect</button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="text-sm text-[var(--text-secondary)] space-y-2">
              <p className="font-medium text-[var(--text-primary)]">Prerequisites</p>
              <p>The sandbox must have a VNC desktop environment running. Install the <strong>VNC Desktop</strong> extension from the Extensions tab, which sets up:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Xvfb virtual framebuffer on display :99</li>
                <li>XFCE4 desktop environment</li>
                <li>x11vnc on port 5900</li>
                <li>noVNC + websockify on port 6080</li>
              </ul>
              <p>If you get &quot;Bad Gateway&quot;, the VNC server isn&apos;t running yet. Go to Terminal and run the setup commands, or install the extension first.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">VNC — port {customPort}</p>
        <div className="flex gap-2">
          <a href={vncUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost text-sm"><Maximize2 className="w-3 h-3" /> New Tab</a>
          <button onClick={() => setConnected(false)} className="btn btn-ghost text-sm">Disconnect</button>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden border border-[var(--border)] bg-black" style={{ height: "600px" }}>
        <iframe src={vncUrl} className="w-full h-full border-0" allow="clipboard-read; clipboard-write" title="VNC" />
      </div>
    </div>
  );
}
