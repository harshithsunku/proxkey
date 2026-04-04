"""SSH key injection logic for LXC containers and VMs."""

import logging
import hashlib
import base64
from ..models import HostType
from . import proxmox as px_service

logger = logging.getLogger(__name__)

AUTHORIZED_KEYS_PATH = "/root/.ssh/authorized_keys"
SSH_DIR = "/root/.ssh"


def compute_fingerprint(public_key: str) -> str:
    """Compute MD5 fingerprint of an SSH public key."""
    try:
        parts = public_key.strip().split()
        if len(parts) < 2:
            return ""
        key_data = base64.b64decode(parts[1])
        digest = hashlib.md5(key_data).hexdigest()
        return ":".join(digest[i:i + 2] for i in range(0, len(digest), 2))
    except Exception:
        return ""


def inject_key_lxc(node: str, vmid: int, public_key: str, user: str = "root") -> str:
    """Inject an SSH public key into a running LXC container.

    Uses pct exec to:
    1. Create ~/.ssh directory if it doesn't exist
    2. Add the key to authorized_keys (idempotent — skips if already present)
    3. Fix permissions

    Returns a success message or raises RuntimeError.
    """
    key = public_key.strip()
    ssh_dir = f"/home/{user}/.ssh" if user != "root" else SSH_DIR
    auth_keys = f"/home/{user}/.ssh/authorized_keys" if user != "root" else AUTHORIZED_KEYS_PATH

    # Base64-encode the script to avoid all quoting issues through SSH + pct exec
    script = f"""
set -e
mkdir -p {ssh_dir}
chmod 700 {ssh_dir}
touch {auth_keys}
KEY=$(echo '{base64.b64encode(key.encode()).decode()}' | base64 -d)
if grep -qF "$KEY" {auth_keys} 2>/dev/null; then
    echo "KEY_ALREADY_PRESENT"
else
    echo "$KEY" >> {auth_keys}
    echo "KEY_INJECTED"
fi
chmod 600 {auth_keys}
chown -R {user}:{user} {ssh_dir}
""".strip()

    # Encode the entire script as base64 for safe transport
    encoded_script = base64.b64encode(script.encode()).decode()
    command = f"echo {encoded_script} | base64 -d | bash"

    output = px_service.exec_lxc(node, vmid, command)

    if "KEY_ALREADY_PRESENT" in output:
        return f"Key already present in {auth_keys} on CT {vmid}"
    elif "KEY_INJECTED" in output:
        return f"Key successfully injected into {auth_keys} on CT {vmid}"
    else:
        return f"Injection completed on CT {vmid}: {output}"


def inject_key_qemu(node: str, vmid: int, public_key: str, user: str = "root") -> str:
    """Inject an SSH public key into a running QEMU VM via guest agent.

    Uses qm guest exec to:
    1. Create ~/.ssh directory if it doesn't exist
    2. Add the key to authorized_keys (idempotent — skips if already present)
    3. Fix permissions

    Returns a success message or raises RuntimeError.
    """
    key = public_key.strip()
    ssh_dir = f"/home/{user}/.ssh" if user != "root" else SSH_DIR
    auth_keys = f"/home/{user}/.ssh/authorized_keys" if user != "root" else AUTHORIZED_KEYS_PATH

    script = f"""
set -e
mkdir -p {ssh_dir}
chmod 700 {ssh_dir}
touch {auth_keys}
KEY=$(echo '{base64.b64encode(key.encode()).decode()}' | base64 -d)
if grep -qF "$KEY" {auth_keys} 2>/dev/null; then
    echo "KEY_ALREADY_PRESENT"
else
    echo "$KEY" >> {auth_keys}
    echo "KEY_INJECTED"
fi
chmod 600 {auth_keys}
chown -R {user}:{user} {ssh_dir}
""".strip()

    encoded_script = base64.b64encode(script.encode()).decode()
    command = f"echo {encoded_script} | base64 -d | bash"

    output = px_service.exec_qemu(node, vmid, command)

    if "KEY_ALREADY_PRESENT" in output:
        return f"Key already present in {auth_keys} on VM {vmid}"
    elif "KEY_INJECTED" in output:
        return f"Key successfully injected into {auth_keys} on VM {vmid}"
    else:
        return f"Injection completed on VM {vmid}: {output}"


def revoke_key_lxc(node: str, vmid: int, public_key: str, user: str = "root") -> str:
    """Remove an SSH public key from a running LXC container."""
    key = public_key.strip()
    auth_keys = f"/home/{user}/.ssh/authorized_keys" if user != "root" else AUTHORIZED_KEYS_PATH

    # Use grep -v to remove the line containing the key
    key_b64 = base64.b64encode(key.encode()).decode()
    script = f"""
set -e
KEY=$(echo '{key_b64}' | base64 -d)
if [ ! -f {auth_keys} ]; then
    echo "KEY_NOT_FOUND"
    exit 0
fi
if grep -qF "$KEY" {auth_keys} 2>/dev/null; then
    grep -vF "$KEY" {auth_keys} > {auth_keys}.tmp || true
    mv {auth_keys}.tmp {auth_keys}
    chmod 600 {auth_keys}
    echo "KEY_REVOKED"
else
    echo "KEY_NOT_FOUND"
fi
""".strip()

    encoded_script = base64.b64encode(script.encode()).decode()
    command = f"echo {encoded_script} | base64 -d | bash"

    output = px_service.exec_lxc(node, vmid, command)

    if "KEY_REVOKED" in output:
        return f"Key revoked from {auth_keys} on CT {vmid}"
    elif "KEY_NOT_FOUND" in output:
        return f"Key was not present in {auth_keys} on CT {vmid}"
    else:
        return f"Revocation completed on CT {vmid}: {output}"


def revoke_key_qemu(node: str, vmid: int, public_key: str, user: str = "root") -> str:
    """Remove an SSH public key from a running QEMU VM."""
    key = public_key.strip()
    auth_keys = f"/home/{user}/.ssh/authorized_keys" if user != "root" else AUTHORIZED_KEYS_PATH

    key_b64 = base64.b64encode(key.encode()).decode()
    script = f"""
set -e
KEY=$(echo '{key_b64}' | base64 -d)
if [ ! -f {auth_keys} ]; then
    echo "KEY_NOT_FOUND"
    exit 0
fi
if grep -qF "$KEY" {auth_keys} 2>/dev/null; then
    grep -vF "$KEY" {auth_keys} > {auth_keys}.tmp || true
    mv {auth_keys}.tmp {auth_keys}
    chmod 600 {auth_keys}
    echo "KEY_REVOKED"
else
    echo "KEY_NOT_FOUND"
fi
""".strip()

    encoded_script = base64.b64encode(script.encode()).decode()
    command = f"echo {encoded_script} | base64 -d | bash"

    output = px_service.exec_qemu(node, vmid, command)

    if "KEY_REVOKED" in output:
        return f"Key revoked from {auth_keys} on VM {vmid}"
    elif "KEY_NOT_FOUND" in output:
        return f"Key was not present in {auth_keys} on VM {vmid}"
    else:
        return f"Revocation completed on VM {vmid}: {output}"


def inject_key(node: str, vmid: int, host_type: HostType, public_key: str, user: str = "root") -> str:
    """Inject an SSH public key into a host."""
    if host_type == HostType.lxc:
        return inject_key_lxc(node, vmid, public_key, user)
    elif host_type == HostType.qemu:
        return inject_key_qemu(node, vmid, public_key, user)
    else:
        raise ValueError(f"Unknown host type: {host_type}")


def revoke_key(node: str, vmid: int, host_type: HostType, public_key: str, user: str = "root") -> str:
    """Remove an SSH public key from a host."""
    if host_type == HostType.lxc:
        return revoke_key_lxc(node, vmid, public_key, user)
    elif host_type == HostType.qemu:
        return revoke_key_qemu(node, vmid, public_key, user)
    else:
        raise ValueError(f"Unknown host type: {host_type}")
