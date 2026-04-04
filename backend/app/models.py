from sqlmodel import SQLModel, Field
from datetime import datetime, timezone
from typing import Optional
from enum import Enum


# --- Enums ---

class HostType(str, Enum):
    lxc = "lxc"
    qemu = "qemu"


class HostStatus(str, Enum):
    running = "running"
    stopped = "stopped"
    unknown = "unknown"


class DeployStatus(str, Enum):
    pending = "pending"
    deployed = "deployed"
    failed = "failed"


# --- Database Models ---

class SSHKey(SQLModel, table=True):
    __tablename__ = "ssh_keys"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    public_key: str
    fingerprint: str = ""
    is_default: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class KeyDeployment(SQLModel, table=True):
    __tablename__ = "key_deployments"

    id: Optional[int] = Field(default=None, primary_key=True)
    key_id: int = Field(foreign_key="ssh_keys.id", index=True)
    host_vmid: int = Field(index=True)
    host_type: HostType
    host_name: str = ""
    node: str = ""
    status: DeployStatus = Field(default=DeployStatus.pending)
    error_message: str = ""
    deployed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    action: str
    target: str
    detail: str = ""
    success: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# --- API Schemas ---

class SSHKeyCreate(SQLModel):
    name: str
    public_key: str
    is_default: bool = False


class SSHKeyRead(SQLModel):
    id: int
    name: str
    public_key: str
    fingerprint: str
    is_default: bool
    created_at: datetime


class HostInfo(SQLModel):
    vmid: int
    name: str
    host_type: HostType
    status: HostStatus
    node: str
    cpus: int = 0
    memory_mb: int = 0
    disk_gb: float = 0
    uptime: int = 0
    deploy_status: Optional[DeployStatus] = None
    deployed_keys: int = 0


class DeployRequest(SQLModel):
    key_id: int
    host_vmids: list[int]
    user: str = "root"


class DeployResult(SQLModel):
    vmid: int
    host_name: str
    success: bool
    message: str
