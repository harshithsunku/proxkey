# CLAUDE.md — AI Context for ProxKey

## What is this project?

ProxKey is a self-hosted web application for managing and distributing SSH public keys across Proxmox VE LXC containers and QEMU VMs. It uses the Proxmox API for host discovery and `pct exec`/`qm guest exec` for zero-bootstrap key injection (no prior SSH access needed).

## Key design decisions

- **Zero-bootstrap**: Keys are injected via Proxmox's `pct exec` (LXC) or `qm guest exec` (QEMU), not via SSH. This means ProxKey can inject keys into brand-new containers that have no SSH access yet.
- **Dual execution paths**: If ProxKey runs on the Proxmox host, it calls `pct exec` directly. If remote, it SSHes to the Proxmox host first via `sshpass`, then runs `pct exec`. This is configured via `PROXMOX_SSH_PASSWORD`.
- **Base64 transport**: Injection scripts are base64-encoded before being piped through `pct exec` / `qm guest exec` to avoid shell quoting issues across multiple layers (SSH → pct exec → bash).
- **Idempotent injection**: The inject script checks `grep -qF` before appending, so deploying the same key twice is safe.
- **SQLite database**: Lightweight, single-file, deployed as a Docker volume. Stores keys, deployment records, and audit logs.

## Tech stack

- **Backend**: Python 3.11, FastAPI, SQLModel (SQLAlchemy + Pydantic), proxmoxer
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack React Query, Zustand
- **Deployment**: Docker Compose with nginx reverse proxy (frontend) + uvicorn (backend)

## Project structure

```
backend/app/
  main.py          — FastAPI app, CORS, lifespan, router includes
  config.py        — Pydantic BaseSettings, reads from .env
  database.py      — SQLite engine + session factory
  models.py        — All DB models (SSHKey, KeyDeployment, AuditLog) + API schemas
  routers/
    hosts.py       — GET /api/hosts (discovery + enrichment), GET /api/hosts/{vmid}/keys
    keys.py        — CRUD for SSH keys
    deploy.py      — POST deploy/revoke, GET stats/audit/status
    hooks.py       — POST /api/hooks/lxc-started (auto-inject on container start)
  services/
    proxmox.py     — Proxmox API client, discover_lxc/qemu, exec_lxc/qemu, IP fetching
    injector.py    — inject_key, revoke_key (LXC + QEMU), compute_fingerprint

frontend/src/
  App.tsx           — Top-level layout with 4 tabs: Dashboard, Hosts, SSH Keys, Audit Log
  api/client.ts     — Fetch wrapper + all API functions
  api/types.ts      — TypeScript interfaces matching backend schemas
  api/hooks.ts      — React Query hooks for all API calls
  store/app.ts      — Zustand store (active tab, host selection)
  components/
    Dashboard.tsx       — Stats cards, host breakdown, coverage donut chart
    HostGrid.tsx        — Host cards with IP display, SSH copy button, search/filter/sort
    DeployPanel.tsx     — Deploy/revoke toggle, key inspect panel, bulk actions
    KeyManager.tsx      — Add/delete SSH keys, fingerprint copy
    AuditLog.tsx        — Event history table
    StatusBadge.tsx     — Colored status pill component
    ConnectionBadge.tsx — Proxmox API connection indicator in header
```

## How to run locally (development)

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env  # edit with your Proxmox credentials
uvicorn app.main:app --reload  # http://localhost:8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev  # http://localhost:5173
# Vite proxies /api → localhost:8000
```

## How to deploy (Docker)

```bash
cp .env.example .env  # edit credentials
docker compose up -d
# Frontend: http://localhost:8080, Backend API: http://localhost:8000
```

## Common tasks

- **Add a new API endpoint**: Add route in `backend/app/routers/`, add schema to `models.py` if needed, register router in `main.py` if it's a new file.
- **Add a new frontend feature**: Add types in `api/types.ts`, API function in `api/client.ts`, hook in `api/hooks.ts`, component in `components/`.
- **Change database schema**: Edit `models.py`. SQLModel auto-creates tables on startup. For existing DBs, delete the volume or manually migrate.

## Testing against a Proxmox host

The app connects to a Proxmox host configured in `.env`. For remote testing (when not running on the PVE node itself), set `PROXMOX_SSH_PASSWORD` so the backend can SSH to the host for `pct exec` / `qm guest exec`.

## IP address discovery

- **LXC containers**: Uses Proxmox API `/nodes/{node}/lxc/{vmid}/interfaces` — only works for running containers.
- **QEMU VMs**: Uses QEMU guest agent `/nodes/{node}/qemu/{vmid}/agent/network-get-interfaces` — requires `qemu-guest-agent` installed and running inside the VM.
- Link-local (fe80::) and loopback addresses are filtered out.
