"""Proxmox API client — host discovery and command execution."""

import logging
from proxmoxer import ProxmoxAPI
from ..config import get_settings
from ..models import HostInfo, HostType, HostStatus

logger = logging.getLogger(__name__)

_client: ProxmoxAPI | None = None


def get_client() -> ProxmoxAPI:
    """Return a cached Proxmox API client."""
    global _client
    if _client is None:
        s = get_settings()
        _client = ProxmoxAPI(
            s.proxmox_host,
            port=s.proxmox_port,
            user=s.proxmox_token_id.split("!")[0],
            token_name=s.proxmox_token_id.split("!")[1],
            token_value=s.proxmox_token_secret,
            verify_ssl=s.proxmox_verify_ssl,
        )
    return _client


def reset_client():
    """Force re-creation of the API client (e.g. after config change)."""
    global _client
    _client = None


def _get_lxc_ips(node: str, vmid: int) -> list[str]:
    """Get IP addresses for a running LXC container via Proxmox API."""
    px = get_client()
    ips: list[str] = []
    try:
        interfaces = px.nodes(node).lxc(vmid).interfaces.get()
        for iface in interfaces:
            if iface.get("name") == "lo":
                continue
            hwaddr = iface.get("inet", "")
            if hwaddr:
                # inet field is "ip/cidr"
                ip = hwaddr.split("/")[0]
                if ip:
                    ips.append(ip)
            inet6 = iface.get("inet6", "")
            if inet6:
                ip6 = inet6.split("/")[0]
                if ip6 and not ip6.startswith("fe80"):
                    ips.append(ip6)
    except Exception as e:
        logger.debug("Could not get interfaces for CT %d: %s", vmid, e)
    return ips


def _get_qemu_ips(node: str, vmid: int) -> list[str]:
    """Get IP addresses for a running QEMU VM via guest agent."""
    px = get_client()
    ips: list[str] = []
    try:
        result = px.nodes(node).qemu(vmid).agent("network-get-interfaces").get()
        for iface in result.get("result", []):
            if iface.get("name") == "lo":
                continue
            for addr in iface.get("ip-addresses", []):
                ip = addr.get("ip-address", "")
                if ip and addr.get("ip-address-type") == "ipv4":
                    ips.append(ip)
                elif ip and addr.get("ip-address-type") == "ipv6" and not ip.startswith("fe80"):
                    ips.append(ip)
    except Exception as e:
        logger.debug("Could not get IPs for VM %d (guest agent may not be running): %s", vmid, e)
    return ips


def discover_lxc(node: str | None = None) -> list[HostInfo]:
    """List all LXC containers on the given node (or default node)."""
    px = get_client()
    node = node or get_settings().proxmox_node
    hosts: list[HostInfo] = []

    try:
        containers = px.nodes(node).lxc.get()
    except Exception as e:
        logger.error("Failed to list LXC containers on node %s: %s", node, e)
        return hosts

    for ct in containers:
        status_str = ct.get("status", "unknown")
        try:
            status = HostStatus(status_str)
        except ValueError:
            status = HostStatus.unknown

        vmid = int(ct["vmid"])
        ip_addresses = _get_lxc_ips(node, vmid) if status == HostStatus.running else []

        hosts.append(
            HostInfo(
                vmid=vmid,
                name=ct.get("name", f"CT-{ct['vmid']}"),
                host_type=HostType.lxc,
                status=status,
                node=node,
                cpus=int(ct.get("cpus", 0)),
                memory_mb=int(ct.get("maxmem", 0)) // (1024 * 1024),
                disk_gb=round(int(ct.get("maxdisk", 0)) / (1024**3), 1),
                uptime=int(ct.get("uptime", 0)),
                ip_addresses=ip_addresses,
            )
        )

    return sorted(hosts, key=lambda h: h.vmid)


def discover_qemu(node: str | None = None) -> list[HostInfo]:
    """List all QEMU VMs on the given node."""
    px = get_client()
    node = node or get_settings().proxmox_node
    hosts: list[HostInfo] = []

    try:
        vms = px.nodes(node).qemu.get()
    except Exception as e:
        logger.error("Failed to list QEMU VMs on node %s: %s", node, e)
        return hosts

    for vm in vms:
        status_str = vm.get("status", "unknown")
        try:
            status = HostStatus(status_str)
        except ValueError:
            status = HostStatus.unknown

        vmid = int(vm["vmid"])
        ip_addresses = _get_qemu_ips(node, vmid) if status == HostStatus.running else []

        hosts.append(
            HostInfo(
                vmid=vmid,
                name=vm.get("name", f"VM-{vm['vmid']}"),
                host_type=HostType.qemu,
                status=status,
                node=node,
                cpus=int(vm.get("cpus", 0)),
                memory_mb=int(vm.get("maxmem", 0)) // (1024 * 1024),
                disk_gb=round(int(vm.get("maxdisk", 0)) / (1024**3), 1),
                uptime=int(vm.get("uptime", 0)),
                ip_addresses=ip_addresses,
            )
        )

    return sorted(hosts, key=lambda h: h.vmid)


def discover_all(node: str | None = None) -> list[HostInfo]:
    """Discover all LXC + QEMU hosts."""
    return discover_lxc(node) + discover_qemu(node)


def exec_lxc(node: str, vmid: int, command: str) -> str:
    """Run a command inside a running LXC container.

    Tries in order:
    1. Local `pct exec` (when running on the Proxmox host)
    2. SSH to the Proxmox host and run `pct exec` remotely
    """
    import shutil
    import subprocess

    px = get_client()
    # Verify container is running
    try:
        result = px.nodes(node).lxc(vmid).status.current.get()
        if result.get("status") != "running":
            raise RuntimeError(f"Container {vmid} is not running (status={result.get('status')})")
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Cannot reach container {vmid}: {e}") from e

    # Try local pct first
    if shutil.which("pct"):
        proc = subprocess.run(
            ["pct", "exec", str(vmid), "--", "bash", "-c", command],
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"pct exec failed: {proc.stderr.strip()}")
        return proc.stdout.strip()

    # Fallback: SSH to the Proxmox host and run pct exec
    s = get_settings()
    if not s.proxmox_ssh_password:
        raise RuntimeError(
            "pct not found locally and PROXMOX_SSH_PASSWORD not set. "
            "Either run ProxKey on the Proxmox host or configure SSH credentials."
        )

    # SSH joins all trailing args into one string for the remote shell.
    # The command from the injector is already a base64 pipeline like:
    #   echo <b64> | base64 -d | bash
    # which is safe to embed in single quotes (no single quotes in base64).
    remote_cmd = f"pct exec {vmid} -- bash -c '{command}'"
    ssh_cmd = [
        "sshpass", "-p", s.proxmox_ssh_password,
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-p", str(s.proxmox_ssh_port),
        f"{s.proxmox_ssh_user}@{s.proxmox_host}",
        remote_cmd,
    ]
    proc = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"Remote pct exec failed: {proc.stderr.strip()}")
    return proc.stdout.strip()


def exec_qemu(node: str, vmid: int, command: str) -> str:
    """Run a command inside a running QEMU VM via guest agent.

    Tries in order:
    1. Local `qm guest exec` (when running on the Proxmox host)
    2. SSH to the Proxmox host and run `qm guest exec` remotely
    """
    import shutil
    import subprocess
    import json

    px = get_client()
    # Verify VM is running
    try:
        result = px.nodes(node).qemu(vmid).status.current.get()
        if result.get("status") != "running":
            raise RuntimeError(f"VM {vmid} is not running (status={result.get('status')})")
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"Cannot reach VM {vmid}: {e}") from e

    # Try local qm first
    if shutil.which("qm"):
        proc = subprocess.run(
            ["qm", "guest", "exec", str(vmid), "--", "bash", "-c", command],
            capture_output=True, text=True, timeout=30,
        )
        if proc.returncode != 0:
            raise RuntimeError(f"qm guest exec failed: {proc.stderr.strip()}")
        # qm guest exec returns JSON with out-data
        try:
            data = json.loads(proc.stdout)
            return data.get("out-data", "").strip()
        except json.JSONDecodeError:
            return proc.stdout.strip()

    # Fallback: SSH to the Proxmox host
    s = get_settings()
    if not s.proxmox_ssh_password:
        raise RuntimeError(
            "qm not found locally and PROXMOX_SSH_PASSWORD not set. "
            "Either run ProxKey on the Proxmox host or configure SSH credentials."
        )

    remote_cmd = f"qm guest exec {vmid} -- bash -c '{command}'"
    ssh_cmd = [
        "sshpass", "-p", s.proxmox_ssh_password,
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-p", str(s.proxmox_ssh_port),
        f"{s.proxmox_ssh_user}@{s.proxmox_host}",
        remote_cmd,
    ]
    proc = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"Remote qm guest exec failed: {proc.stderr.strip()}")
    try:
        data = json.loads(proc.stdout)
        return data.get("out-data", "").strip()
    except json.JSONDecodeError:
        return proc.stdout.strip()


def test_connection() -> dict:
    """Test the Proxmox API connection and return version info."""
    try:
        px = get_client()
        version = px.version.get()
        return {"ok": True, "version": version.get("version", "unknown"), "release": version.get("release", "")}
    except Exception as e:
        return {"ok": False, "error": str(e)}
