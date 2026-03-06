# Borna - OpenSandbox Health Monitoring Dashboard

A modern Next.js dashboard for monitoring and managing OpenSandbox instances.

## Features

- **Real-time Dashboard** - Live health monitoring with auto-refresh
- **Sandbox Management** - Snapshots, cloning, and sharing controls
- **API Key Management** - RBAC with admin/user/viewer roles
- **Audit Log Viewer** - Searchable audit trail with filters
- **Cost Tracking** - Per-sandbox and aggregate cost monitoring
- **Webhook Management** - Register and manage event webhooks

## Quick Start

```bash
cd borna
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

Set your OpenSandbox server URL via environment variable:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
```

Click "Configure API Key" in the sidebar to set your API key.

## Build

```bash
npm run build
npm start
```
