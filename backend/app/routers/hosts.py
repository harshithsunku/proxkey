"""Host discovery endpoints."""

from fastapi import APIRouter, Query
from ..services.proxmox import discover_all, discover_lxc, discover_qemu, test_connection
from ..models import HostInfo, HostType, DeployStatus
from ..database import get_session
from ..models import KeyDeployment
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
