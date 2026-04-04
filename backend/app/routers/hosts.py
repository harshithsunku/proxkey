"""Host discovery endpoints."""

from fastapi import APIRouter, Query, Depends
from ..services.proxmox import discover_all, discover_lxc, discover_qemu, test_connection
from ..models import (
    HostInfo, HostType, DeployStatus,
    KeyDeployment, SSHKey,
    HostKeyEntry, HostKeysResponse,
)
from ..database import get_session
from sqlmodel import Session, select, func

router = APIRouter(prefix="/api/hosts", tags=["hosts"])


@router.get("", response_model=list[HostInfo])
def list_hosts(
    host_type: HostType | None = Query(None, description="Filter by host type"),
    node: str | None = Query(None, description="Proxmox node name"),
):
    """Discover all LXC containers and VMs from Proxmox."""
    if host_type == HostType.lxc:
        hosts = discover_lxc(node)
    elif host_type == HostType.qemu:
        hosts = discover_qemu(node)
    else:
        hosts = discover_all(node)

    # Enrich with deployment status from DB
    session = next(get_session())
    for host in hosts:
        stmt = (
            select(func.count())
            .select_from(KeyDeployment)
            .where(
                KeyDeployment.host_vmid == host.vmid,
                KeyDeployment.status == DeployStatus.deployed,
            )
        )
        host.deployed_keys = session.exec(stmt).one()
        if host.deployed_keys > 0:
            host.deploy_status = DeployStatus.deployed
    session.close()

    return hosts


@router.get("/connection")
def check_connection():
    """Test the Proxmox API connection."""
    return test_connection()


@router.get("/{vmid}/keys", response_model=HostKeysResponse)
def get_host_keys(vmid: int, session: Session = Depends(get_session)):
    """Get all SSH keys deployed on a specific host."""
    deployments = session.exec(
        select(KeyDeployment).where(KeyDeployment.host_vmid == vmid)
    ).all()

    entries: list[HostKeyEntry] = []
    host_name = ""
    for dep in deployments:
        key = session.get(SSHKey, dep.key_id)
        if not host_name:
            host_name = dep.host_name
        if key:
            entries.append(HostKeyEntry(
                key_id=key.id,
                key_name=key.name,
                fingerprint=key.fingerprint,
                is_default=key.is_default,
                deployed_at=dep.deployed_at,
                status=dep.status,
            ))

    return HostKeysResponse(vmid=vmid, host_name=host_name, keys=entries)
