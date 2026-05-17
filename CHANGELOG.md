# Changelog

All notable changes to ProxKey are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html); pre-1.0
releases may break APIs between minor versions when needed.

## [0.1.0] — 2026-05-17

**First public release.** Zero-bootstrap SSH key distribution across
Proxmox LXC containers and QEMU VMs, with a real-time web UI, dashboard,
and audit log. A polished GitHub Pages documentation site ships alongside
the code.

### Added

- **Auto-discovery** of all LXC containers and QEMU VMs via the Proxmox
  API. Running hosts have their IP addresses surfaced — LXC via the
  `/lxc/{vmid}/interfaces` endpoint, QEMU via the guest agent's
  `network-get-interfaces`.
- **Zero-bootstrap key injection** — `pct exec` for LXCs and
  `qm guest exec` for QEMU VMs. No prior SSH access required; brand-new
  containers can be SSHed into immediately after creation.
- **Dual execution paths** — when ProxKey runs on the Proxmox node it
  calls `pct exec` directly; when remote, it SSHes to the node first
  (via `sshpass`) and then runs `pct exec`. Controlled by
  `PROXMOX_SSH_PASSWORD`.
- **Base64-framed injection scripts** to avoid shell-quoting bugs across
  SSH → `pct exec` → bash layers.
- **Idempotent deploy** — the inject script `grep -qF`s before
  appending, so deploying the same key twice is safe.
- **Key revocation** with the same execution model as deploy.
- **Hookscript endpoint** — `POST /api/hooks/lxc-started` lets a Proxmox
  hookscript auto-inject keys on container start.
- **Dashboard** with stats cards, host breakdown, key-coverage donut,
  and deployment metrics.
- **Host grid** with search, status/type filters, sort by any column,
  per-host SSH copy button, and a key inspect panel.
- **Key manager** — store multiple SSH public keys, copy fingerprints,
  assign per-host or globally.
- **Audit log** tracking every injection, revocation, and key CRUD
  event with timestamp, host, and outcome.
- **Documentation site** — a hand-crafted static site under
  [`docs/`](docs/) deployed via GitHub Pages at
  https://harshithsunku.github.io/proxkey/. Long-scroll landing,
  architecture deep-dive, full CLI/HTTP reference, dark + light themes,
  copy-buttons, scroll-spy TOC.
- **CONTRIBUTING.md + CODE_OF_CONDUCT.md** — short, project-specific
  guides for the public repo.

### Infrastructure

- **Docker Compose deployment** — backend (FastAPI + uvicorn) and
  frontend (nginx serving the Vite build, proxying `/api`) in two
  containers behind a single host port.
- **CI builds backend + frontend images** on every push to `main` and
  publishes them to GHCR. Tagged pushes (`v*`) create a GitHub Release
  with the `docker-compose.yml` attached.
- **GitHub Pages workflow** publishes `docs/` on every push to `main`.
- A license, build status, latest-release, and stars badge live at the
  top of the README.
