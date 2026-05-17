# ProxKey — Project Reference

Self-hosted web app for distributing SSH public keys across Proxmox LXC
containers and QEMU VMs. Talks to the Proxmox API for discovery and uses
`pct exec` (LXC) / `qm guest exec` (QEMU) for **zero-bootstrap** key
injection — no prior SSH access to the guest is required.

Generic open-source project — no proprietary names, no company-specific
references, no IPs, credentials, or secrets anywhere in the repo or its
history. The `.env` file is the only place real values live.

---

## Architecture

```
[Browser]                          [ProxKey backend]                  [Proxmox node]               [Guest]
  React SPA                          FastAPI (uvicorn)                   Proxmox API
   |                                   |                                   |
   |  HTTP /api/*  ---------------->  proxmoxer (REST)  --------------->  API token
   |                                   |                                   |
   |                                   |   pct exec / qm guest exec  -->  bash
   |                                   |   (direct OR ssh-then-exec)      |
   |                                   |                                   v
   |                                   |                              authorized_keys
   |                                   |
   |                                   v
   |                                SQLite (SQLModel)
   |                                  keys, deployments, audit log
```

### Key design decisions

- **Zero-bootstrap.** Injection goes through the Proxmox API, not through SSH.
  Brand-new containers with no SSH access yet are first-class targets.
- **Dual execution paths.** When ProxKey runs on the Proxmox node it calls
  `pct exec` / `qm guest exec` directly. When it runs anywhere else, it
  SSHes to the node first (via `sshpass`) and then runs `pct exec` there.
  Toggle is implicit: `PROXMOX_SSH_PASSWORD` set ⇒ remote mode.
- **Base64 transport.** Injection scripts are base64-encoded before being
  piped through `pct exec` / `qm guest exec` so shell quoting can't mangle
  them across SSH → `pct exec` → bash layers.
- **Idempotent injection.** The inject script `grep -qF`s before appending,
  so deploying the same key twice is safe. Revoke removes only matching
  lines.
- **Single-file SQLite.** Stored in `/data/proxkey.db` inside the container,
  mounted as a Docker volume. Holds the key library, per-deployment records,
  and the audit log.
- **Two-container deploy.** Backend container (FastAPI + uvicorn) and
  frontend container (nginx serving the Vite build, proxying `/api`) wired
  together with Docker Compose.
- **Tag-driven releases.** Pushing `v<x.y.z>` triggers an image build to
  GHCR plus a GitHub Release with the compose file attached.

---

## File layout

```
proxkey/
├── backend/                       # Python FastAPI backend
│   └── app/
│       ├── main.py                # App init, CORS, lifespan, routers
│       ├── config.py              # Pydantic BaseSettings (.env loader)
│       ├── database.py            # SQLModel SQLite engine + session factory
│       ├── models.py              # DB models (SSHKey, KeyDeployment, AuditLog) + API schemas
│       ├── routers/
│       │   ├── hosts.py           # GET /api/hosts, /api/hosts/connection, /api/hosts/{vmid}/keys
│       │   ├── keys.py            # CRUD for SSH keys
│       │   ├── deploy.py          # Deploy, revoke, stats, status, audit
│       │   └── hooks.py           # POST /api/hooks/lxc-started (auto-inject on start)
│       └── services/
│           ├── proxmox.py         # proxmoxer wrapper, discovery, exec wrappers, IP fetch
│           └── injector.py        # inject_key, revoke_key (LXC + QEMU), compute_fingerprint
│
├── frontend/                      # React + TypeScript SPA
│   └── src/
│       ├── App.tsx                # Layout, top-level tabs
│       ├── api/
│       │   ├── client.ts          # Fetch wrapper + API functions
│       │   ├── types.ts           # TypeScript interfaces matching backend schemas
│       │   └── hooks.ts           # React Query hooks
│       ├── components/
│       │   ├── Dashboard.tsx      # Stats cards, host breakdown, coverage donut
│       │   ├── HostGrid.tsx       # Host cards with IP, SSH copy, search/filter/sort
│       │   ├── DeployPanel.tsx    # Deploy/revoke + per-host key inspection
│       │   ├── KeyManager.tsx     # Add / update / delete SSH keys
│       │   ├── AuditLog.tsx       # Event history table
│       │   ├── StatusBadge.tsx    # Reusable status pill
│       │   └── ConnectionBadge.tsx# Proxmox API connection indicator
│       └── store/app.ts           # Zustand store (active tab, host selection)
│
├── docs/                          # GitHub Pages docs site (hand-crafted, vanilla)
│   ├── index.html
│   ├── architecture.html
│   ├── reference.html
│   ├── hero.svg
│   ├── architecture.svg
│   └── assets/
│       ├── styles.css
│       └── docs.js
│
├── docker-compose.yml
├── .github/workflows/
│   ├── build.yml                  # Docker image build + GHCR push + release
│   └── pages.yml                  # GitHub Pages deploy
├── start.sh                       # Convenience local-dev launcher
├── .env.example                   # Documented variable list
├── VERSION
├── LICENSE (MIT)
├── README.md
└── CLAUDE.md                      # This file
```

---

## HTTP API

| Endpoint                      | Method | Description                                                |
|-------------------------------|--------|------------------------------------------------------------|
| `/api/health`                 | GET    | Health check (always 200 if process is up)                 |
| `/api/hosts`                  | GET    | All LXC + QEMU hosts with status, type, IP if running      |
| `/api/hosts/connection`       | GET    | Test Proxmox API token + connectivity                      |
| `/api/hosts/{vmid}/keys`      | GET    | Inspect deployed keys inside a single host                 |
| `/api/keys`                   | GET    | List stored SSH public keys                                |
| `/api/keys`                   | POST   | Add a key (auto-computes fingerprint)                      |
| `/api/keys/{id}`              | PUT    | Update key label or scope                                  |
| `/api/keys/{id}`              | DELETE | Remove a key from the library                              |
| `/api/deploy`                 | POST   | Deploy one or more keys to one or more hosts               |
| `/api/deploy/revoke`          | POST   | Revoke a key from one or more hosts                        |
| `/api/deploy/stats`           | GET    | Dashboard stats (hosts by type/status, key coverage, etc.) |
| `/api/deploy/status`          | GET    | Full deployment record list                                |
| `/api/deploy/audit`           | GET    | Audit log                                                  |
| `/api/hooks/lxc-started`      | POST   | Hookscript receiver — auto-injects global keys             |

---

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. Load-bearing:

```
PROXMOX_HOST            # Proxmox server IP or hostname
PROXMOX_PORT            # Proxmox API port (default 8006)
PROXMOX_VERIFY_SSL      # true/false — disable for self-signed certs
PROXMOX_TOKEN_ID        # API token ID: user@realm!tokenname
PROXMOX_TOKEN_SECRET    # API token secret
PROXMOX_NODE            # Default node name (e.g. pve)
PROXMOX_SSH_USER        # SSH user on the PVE node (default root)
PROXMOX_SSH_PASSWORD    # Only required when ProxKey runs OFF the PVE node
PROXMOX_SSH_PORT        # SSH port on the PVE node (default 22)
SECRET_KEY              # Random string for internal token signing
CORS_ORIGINS            # Comma-separated allowed UI origins
```

The `DATABASE_URL` for the SQLite file is set in `docker-compose.yml`
(`sqlite:///./data/proxkey.db` relative to the backend container's working
directory). The named volume `db_data` is mounted at `/app/data`, so the
DB file lands at `/app/data/proxkey.db`.

---

## Development rules

- **Zero-bootstrap stays zero-bootstrap.** Don't add code paths that need
  prior SSH access to the guest. The Proxmox API is the only injection
  channel.
- **Idempotent everything.** Deploy twice → no duplicate. Revoke missing →
  no error. Hookscript re-fire → no double-inject.
- **Defensive shell.** Anything crossing SSH or `pct exec` is base64-framed.
  Never concatenate user input into a shell command.
- **Generic + open.** No proprietary names, no IPs, no credentials, no
  company references in code, docs, or history.
- **No over-engineering.** If a piece of code doesn't earn its complexity,
  it gets cut.
- **Test end-to-end before committing.** Backend + frontend + at least one
  real LXC and one real QEMU VM.

---

## How to run locally

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env             # edit with real Proxmox credentials
uvicorn app.main:app --reload       # http://localhost:8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
# Vite proxies /api → localhost:8000
```

## How to deploy (Docker)

```bash
cp .env.example .env                # edit credentials
docker compose up -d
# UI:  http://localhost:8080
# API: http://localhost:8000
```

---

## Common tasks

- **Add a new API endpoint.** Add a route in `backend/app/routers/`, add the
  schema to `models.py` if needed, register the router in `main.py` only
  if it's a new file.
- **Add a new frontend feature.** Add types in `api/types.ts`, an API
  function in `api/client.ts`, a hook in `api/hooks.ts`, then a component
  in `components/`.
- **Change DB schema.** Edit `models.py`. SQLModel auto-creates tables on
  startup. For existing deployments, either delete the volume or migrate
  manually.

---

## IP address discovery

- **LXC containers** — Proxmox API `/nodes/{node}/lxc/{vmid}/interfaces`
  (running only).
- **QEMU VMs** — QEMU guest agent
  `/nodes/{node}/qemu/{vmid}/agent/network-get-interfaces` (requires
  `qemu-guest-agent` installed and running in the guest).
- Link-local (`fe80::`) and loopback addresses are filtered out before
  surfacing in the UI.

---

## Known limitations

- One Proxmox cluster at a time (single `PROXMOX_HOST` and `PROXMOX_NODE`).
  Multi-cluster is not modeled yet.
- QEMU IP/exec needs `qemu-guest-agent` running in the guest — there's no
  fallback if it isn't.
- Remote mode (running ProxKey off the PVE node) requires SSH password
  auth to the node. Key-based SSH-to-node is on the roadmap.
- LXC `interfaces` API only reports IPs after the network stack is up;
  expect a ~5-second blank window after start.
- Single API token per ProxKey instance; you can't fan out to multiple
  nodes with different credentials.
