"""Hookscript receiver for auto-inject on container start."""

import logging
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from ..database import get_session
from ..models import SSHKey, AuditLog
from ..services.proxmox import discover_lxc
from ..services.injector import inject_key_lxc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/hooks", tags=["hooks"])


@router.post("/lxc-started")
def lxc_started(
    ctid: int = Query(..., description="Container ID that just started"),
    node: str | None = Query(None, description="Proxmox node name"),
    session: Session = Depends(get_session),
):
    """Called by a Proxmox hookscript when an LXC container starts.

    Injects all default SSH keys into the newly started container.
    """
    # Find default keys
    default_keys = session.exec(select(SSHKey).where(SSHKey.is_default == True)).all()
    if not default_keys:
        return {"status": "skipped", "reason": "no default keys configured"}

    # Resolve node from discovery if not provided
    if not node:
        hosts = discover_lxc()
        host = next((h for h in hosts if h.vmid == ctid), None)
        if not host:
            return {"status": "error", "reason": f"Container {ctid} not found"}
        node = host.node

    results = []
    for key in default_keys:
        try:
            msg = inject_key_lxc(node, ctid, key.public_key)
            results.append({"key": key.name, "success": True, "message": msg})
            session.add(AuditLog(
                action="auto_inject",
                target=f"CT {ctid}",
                detail=f"key={key.name}, trigger=hookscript",
            ))
        except Exception as e:
            logger.error("Auto-inject failed for CT %d, key %s: %s", ctid, key.name, e)
            results.append({"key": key.name, "success": False, "message": str(e)})
            session.add(AuditLog(
                action="auto_inject_failed",
                target=f"CT {ctid}",
                detail=f"key={key.name}, error={e}",
                success=False,
            ))

    session.commit()
    return {"status": "completed", "results": results}
