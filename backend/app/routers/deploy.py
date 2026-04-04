"""Key deployment endpoints."""

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from ..database import get_session
from ..models import (
    SSHKey, KeyDeployment, AuditLog,
    DeployRequest, DeployResult, DeployStatus,
    RevokeRequest, StatsResponse, HostStatus,
)
from ..services.proxmox import discover_all
from ..services.injector import inject_key, revoke_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/deploy", tags=["deploy"])


@router.post("", response_model=list[DeployResult])
def deploy_key(req: DeployRequest, session: Session = Depends(get_session)):
    """Deploy an SSH key to one or more hosts."""
    key = session.get(SSHKey, req.key_id)
    if not key:
        raise HTTPException(status_code=404, detail="SSH key not found")

    all_hosts = discover_all()
    host_map = {h.vmid: h for h in all_hosts}

    results: list[DeployResult] = []

    for vmid in req.host_vmids:
        host = host_map.get(vmid)
        if not host:
            results.append(DeployResult(vmid=vmid, host_name="unknown", success=False, message=f"Host {vmid} not found"))
            continue

        try:
            msg = inject_key(host.node, vmid, host.host_type, key.public_key, req.user)
            success = True
        except Exception as e:
            msg = str(e)
            success = False
            logger.error("Failed to inject key into %s (VMID %d): %s", host.name, vmid, e)

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


@router.post("/revoke", response_model=list[DeployResult])
def revoke_key_endpoint(req: RevokeRequest, session: Session = Depends(get_session)):
    """Revoke (remove) an SSH key from one or more hosts."""
    key = session.get(SSHKey, req.key_id)
    if not key:
        raise HTTPException(status_code=404, detail="SSH key not found")

    all_hosts = discover_all()
    host_map = {h.vmid: h for h in all_hosts}

    results: list[DeployResult] = []

    for vmid in req.host_vmids:
        host = host_map.get(vmid)
        if not host:
            results.append(DeployResult(vmid=vmid, host_name="unknown", success=False, message=f"Host {vmid} not found"))
            continue

        try:
            msg = revoke_key(host.node, vmid, host.host_type, key.public_key, req.user)
            success = True
        except Exception as e:
            msg = str(e)
            success = False
            logger.error("Failed to revoke key from %s (VMID %d): %s", host.name, vmid, e)

        # Remove deployment record
        existing = session.exec(
            select(KeyDeployment).where(
                KeyDeployment.key_id == key.id,
                KeyDeployment.host_vmid == vmid,
            )
        ).first()
        if existing and success:
            session.delete(existing)

        session.add(AuditLog(
            action="key_revoked" if success else "key_revoke_failed",
            target=f"{host.name} (VMID {vmid})",
            detail=f"key={key.name}, user={req.user}",
            success=success,
        ))

        results.append(DeployResult(vmid=vmid, host_name=host.name, success=success, message=msg))

    session.commit()
    return results


@router.get("/stats", response_model=StatsResponse)
def get_stats(session: Session = Depends(get_session)):
    """Get dashboard statistics."""
    all_hosts = discover_all()

    total_keys = session.exec(select(func.count()).select_from(SSHKey)).one()
    default_keys = session.exec(select(func.count()).select_from(SSHKey).where(SSHKey.is_default == True)).one()

    total_deployments = session.exec(select(func.count()).select_from(KeyDeployment)).one()
    successful = session.exec(
        select(func.count()).select_from(KeyDeployment).where(KeyDeployment.status == DeployStatus.deployed)
    ).one()
    failed = session.exec(
        select(func.count()).select_from(KeyDeployment).where(KeyDeployment.status == DeployStatus.failed)
    ).one()

    # Unique hosts with at least one deployed key
    hosts_with_keys = session.exec(
        select(func.count(func.distinct(KeyDeployment.host_vmid)))
        .select_from(KeyDeployment)
        .where(KeyDeployment.status == DeployStatus.deployed)
    ).one()

    running = sum(1 for h in all_hosts if h.status == HostStatus.running)
    stopped = sum(1 for h in all_hosts if h.status == HostStatus.stopped)
    lxc_count = sum(1 for h in all_hosts if h.host_type.value == "lxc")
    qemu_count = sum(1 for h in all_hosts if h.host_type.value == "qemu")
    total = len(all_hosts)

    return StatsResponse(
        total_hosts=total,
        running_hosts=running,
        stopped_hosts=stopped,
        lxc_count=lxc_count,
        qemu_count=qemu_count,
        total_keys=total_keys,
        default_keys=default_keys,
        total_deployments=total_deployments,
        successful_deployments=successful,
        failed_deployments=failed,
        hosts_with_keys=hosts_with_keys,
        coverage_percent=round((hosts_with_keys / total * 100) if total > 0 else 0, 1),
    )


@router.get("/status", response_model=list[KeyDeployment])
def deployment_status(session: Session = Depends(get_session)):
    """Get all deployment records."""
    return session.exec(select(KeyDeployment).order_by(KeyDeployment.created_at.desc())).all()


@router.get("/audit", response_model=list[AuditLog])
def audit_log(limit: int = 50, session: Session = Depends(get_session)):
    """Get recent audit log entries."""
    return session.exec(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
