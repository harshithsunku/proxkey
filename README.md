# ProxKey

SSH Key Manager for Proxmox LXC & VMs.

> Create a container. SSH in immediately. No manual key copying, ever.

ProxKey is a self-hosted web app that distributes SSH keys across Proxmox containers and VMs via the Proxmox API — no prior SSH access needed.

## Features

- **Auto-discovery** — lists all LXC containers and QEMU VMs via Proxmox API
- **IP address display** — shows IP addresses for running hosts (LXC via interfaces API, QEMU via guest agent)
- **Zero-bootstrap injection** — uses `pct exec` for LXCs, `qm guest exec` for QEMU VMs (no SSH required)
- **Key revocation** — remove deployed keys from hosts
- **Auto-inject on creation** — hookscript endpoint triggers key push on container start
- **Key lifecycle** — store multiple SSH public keys, assign per-host or globally
- **Host inspect** — see which keys are deployed on any host
- **Quick SSH connect** �� one-click copy `ssh root@<ip>` command
- **Search & filter** — find hosts by name, VMID, or IP; filter by status/type; sort by any field
- **Dashboard** — stats overview with host breakdown, key coverage chart, deployment metrics
- **Audit log** — tracks every injection, revocation, and key management event

## Quick Start

```bash
# 1. Clone
git clone https://github.com/harshithb3304/proxkey
cd proxkey

# 2. Configure
cp .env.example .env
# Edit .env with your Proxmox host, API token ID, and token secret

# 3. Run
docker compose up -d

# 4. Open http://localhost:8080
```

## Proxmox API Token Setup

```bash
# On your Proxmox host:
pveum user add proxkey@pve
pveum aclmod / -user proxkey@pve -role PVEAuditor
pveum aclmod /vms -user proxkey@pve -role PVEAdmin
pveum user token add proxkey@pve proxkey --privsep 0
# Copy the token secret → add to .env as PROXMOX_TOKEN_SECRET
```

## Architecture

```
proxkey/
├── backend/                  # Python FastAPI backend
│   └── app/
│       ├── main.py           # App init, CORS, routers
│       ├── config.py         # Pydantic settings from .env
│       ├── database.py       # SQLite via SQLModel
│       ├── models.py         # DB models + API schemas
│       ├── routers/
│       │   ├── hosts.py      # Host discovery + key inspection
│       │   ├── keys.py       # SSH key CRUD
│       │   ├── deploy.py     # Deploy, revoke, stats, audit
│       │   └── hooks.py      # Proxmox hookscript receiver
│       └── services/
│           ├── proxmox.py    # Proxmox API client, discovery, exec
│           └── injector.py   # Key injection + revocation logic
├── frontend/                 # React + TypeScript SPA
│   └── src/
│       ├── App.tsx           # Layout, tabs (Dashboard/Hosts/Keys/Audit)
│       ├── api/              # HTTP client, types, React Query hooks
│       ├── components/
│       │   ├── Dashboard.tsx     # Stats overview + charts
│       │   ├── HostGrid.tsx      # Host cards with search/filter/sort
│       │   ├── DeployPanel.tsx   # Deploy/revoke + key inspection
│       │   ├─��� KeyManager.tsx    # SSH key CRUD UI
│       │   ├── AuditLog.tsx      # Event history table
│       │   ��── StatusBadge.tsx   # Reusable status indicator
│       │   └── ConnectionBadge.tsx # Proxmox connection status
│       └── store/app.ts      # Zustand state (tabs, selection)
└── docker-compose.yml        # Backend + frontend containers
```

## Development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# UI: http://localhost:5173 (proxies /api to backend)
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Python 3.11+, FastAPI, SQLModel (SQLite) |
| Proxmox | proxmoxer (REST API client) |
| Frontend | React 19, Vite, Tailwind CSS v4, TanStack Query, Zustand |
| Deploy | Docker Compose (nginx reverse proxy) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/hosts` | List all LXC/VM hosts with IPs |
| GET | `/api/hosts/connection` | Test Proxmox connection |
| GET | `/api/hosts/:vmid/keys` | Get deployed keys for a host |
| GET | `/api/keys` | List SSH keys |
| POST | `/api/keys` | Add SSH key |
| PUT | `/api/keys/:id` | Update SSH key |
| DELETE | `/api/keys/:id` | Delete SSH key |
| POST | `/api/deploy` | Deploy key to hosts |
| POST | `/api/deploy/revoke` | Revoke key from hosts |
| GET | `/api/deploy/stats` | Dashboard statistics |
| GET | `/api/deploy/status` | All deployment records |
| GET | `/api/deploy/audit` | Audit log |
| POST | `/api/hooks/lxc-started` | Hookscript receiver |

## Environment Variables

See [.env.example](.env.example) for all options. Key settings:

| Variable | Description |
|----------|-------------|
| `PROXMOX_HOST` | Proxmox server IP/hostname |
| `PROXMOX_TOKEN_ID` | API token ID (format: `user@realm!tokenname`) |
| `PROXMOX_TOKEN_SECRET` | API token secret |
| `PROXMOX_NODE` | Default node name (e.g., `pve`) |
| `PROXMOX_SSH_PASSWORD` | SSH password for remote `pct exec` fallback |

## License

MIT
