"""Key deployment endpoints."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..database import get_session
from ..models import (
    SSHKey, KeyDeployment, AuditLog,
    DeployRequest, DeployResult, DeployStatus,
)
from ..services.proxmox import discover_all
from ..services.injector import inject_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/deploy", tags=["deploy"])


@router.post("", response_model=list[DeployResult])
def deploy_key(req: DeployRequest, session: Session = Depends(get_session)):
    """Deploy an SSH key to one or more hosts."""
    key = session.get(SSHKey, req.key_id)
    if not key:
        raise HTTPException(status_code=404, detail="SSH key not found")

    # Discover hosts to resolve vmid -> node + type + name
    all_hosts = discover_all()
    host_map = {h.vmid: h for h in all_hosts}

    results: list[DeployResult] = []

    for vmid in req.host_vmids:
        host = host_map.get(vmid)
        if not host:
            results.append(DeployResult(vmid=vmid, host_name="unknown", success=False, message=f"Host {vmid} not found"))
            continue

        # Attempt injection
        try:
            msg = inject_key(host.node, vmid, host.host_type, key.public_key, req.user)
            success = True
        except Exception as e:
            msg = str(e)
            success = False
            logger.error("Failed to inject key into %s (VMID %d): %s", host.name, vmid, e)

        # Record deployment
        existing = session.exec(
            select(KeyDeployment).where(
                KeyDeployment.key_id == key.id,
                KeyDeployment.host_vmid == vmid,
            )
        ).first()

        if existing:
            existing.status = DeployStatus.deployed if success else DeployStatus.failed
            existing.error_message = "" if success else msg
            existing.deployed_at = datetime.now(timezone.utc) if success else None
            session.add(existing)
        else:
            dep = KeyDeployment(
                key_id=key.id,
                host_vmid=vmid,
                host_type=host.host_type,
                host_name=host.name,
                node=host.node,
                status=DeployStatus.deployed if success else DeployStatus.failed,
                error_message="" if success else msg,
                deployed_at=datetime.now(timezone.utc) if success else None,
            )
            session.add(dep)

        session.add(AuditLog(
            action="key_deployed" if success else "key_deploy_failed",
            target=f"{host.name} (VMID {vmid})",
            detail=f"key={key.name}, user={req.user}",
            success=success,
        ))

        results.append(DeployResult(vmid=vmid, host_name=host.name, success=success, message=msg))

    session.commit()
    return results


@router.get("/status", response_model=list[KeyDeployment])
def deployment_status(session: Session = Depends(get_session)):
    """Get all deployment records."""
    return session.exec(select(KeyDeployment).order_by(KeyDeployment.created_at.desc())).all()


@router.get("/audit", response_model=list[AuditLog])
def audit_log(limit: int = 50, session: Session = Depends(get_session)):
    """Get recent audit log entries."""
    return session.exec(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
