# ProxKey

SSH Key Manager for Proxmox LXC & VMs.

> Create a container. SSH in immediately. No manual key copying, ever.

ProxKey is a self-hosted web app that distributes SSH keys across Proxmox containers and VMs via the Proxmox API — no prior SSH access needed.

## Features

- **Auto-discovery** — lists all LXC containers and VMs via Proxmox API
- **Zero-bootstrap injection** — uses `pct exec` for LXCs (no SSH required)
- **Auto-inject on creation** — hookscript endpoint triggers key push on container start
- **Key lifecycle** — store multiple SSH public keys, assign per-host or globally
- **Deployment dashboard** — see which hosts have keys deployed, pending, or failed
- **Audit log** — tracks every injection event

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/proxkey
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
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query, Zustand |
| Deploy | Docker Compose |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/hosts` | List all LXC/VM hosts |
| GET | `/api/hosts/connection` | Test Proxmox connection |
| GET | `/api/keys` | List SSH keys |
| POST | `/api/keys` | Add SSH key |
| DELETE | `/api/keys/:id` | Delete SSH key |
| POST | `/api/deploy` | Deploy key to hosts |
| GET | `/api/deploy/audit` | Audit log |
| POST | `/api/hooks/lxc-started` | Hookscript receiver |

## License

MIT
