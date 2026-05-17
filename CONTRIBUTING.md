# Contributing to ProxKey

Thanks for taking the time. ProxKey is small on purpose, so a short list covers most of what you need to know.

## Ground rules

- **Zero-bootstrap stays zero-bootstrap.** Key injection happens via the Proxmox API (`pct exec` / `qm guest exec`). Don't add code paths that require pre-existing SSH access to the guest.
- **Tight dependency set.** Backend is FastAPI + SQLModel + proxmoxer — nothing else without a reason. Frontend is React + Vite + Tailwind + TanStack Query + Zustand. New runtime deps need a justification in the PR description.
- **Idempotent operations.** Deploying the same key twice must be safe. Revoking a key that isn't there must be safe. The audit log records the attempt either way.
- **No proprietary names, IPs, or credentials** in code, docs, comments, or commit messages. The repo is meant to stay generic — the `.env` is the only place real values live.

## Development setup

```bash
git clone https://github.com/harshithsunku/proxkey.git
cd proxkey
cp .env.example .env
# edit .env with your Proxmox host + API token

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000

# Frontend (separate shell)
cd frontend
npm install
npm run dev                            # http://localhost:5173 (proxies /api)
```

Or run the whole stack with Docker Compose:

```bash
docker compose up -d                   # UI on :8080, API on :8000
```

## Testing against a real Proxmox host

ProxKey only really exercises itself end-to-end against a live Proxmox node. For PR review purposes:

- Confirm `GET /api/hosts/connection` returns a healthy probe.
- Deploy a throwaway key to an LXC and a QEMU VM, then revoke it. Both should land in the audit log.
- Restart a container with the hookscript configured and confirm the auto-inject path fires.

When you don't have a real PVE node handy, mention it in the PR — a maintainer can run the smoke test before merging.

## Reporting issues

Please include:

- ProxKey version (`VERSION` file or container image tag).
- Proxmox version (`pveversion` on the node).
- Backend logs around the failure (`docker compose logs backend`).
- For UI bugs: a screenshot and the browser console log.
- For injection failures: whether the host is LXC or QEMU, the relevant audit-log entry, and the exit code from the injector.

## Pull requests

1. Open an issue first for non-trivial changes. Cheap to discuss, expensive to redo.
2. One concern per PR. A bug fix doesn't need surrounding refactor.
3. Test end-to-end before pushing — backend + frontend + at least one real LXC and one real QEMU VM. Type checks alone aren't enough.
4. Keep commit messages tight. Subject ≤ 70 chars, body wraps at 72, focus on the *why*.
5. Don't add `--no-verify`, `--no-gpg-sign`, or skip CI. If a hook fails, fix the underlying issue.

## Releasing

Releases are tag-driven: pushing `v<x.y.z>` triggers [`.github/workflows/build.yml`](.github/workflows/build.yml), which builds the backend and frontend Docker images, pushes them to GHCR, and creates a GitHub Release with the Compose file attached.

Bump [`VERSION`](VERSION) in the same commit that tags the release.

## License

By contributing you agree your work is offered under the project's [MIT license](LICENSE).
