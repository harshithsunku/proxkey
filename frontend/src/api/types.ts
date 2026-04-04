export type HostType = "lxc" | "qemu";
export type HostStatus = "running" | "stopped" | "unknown";
export type DeployStatus = "pending" | "deployed" | "failed";

export interface HostInfo {
  vmid: number;
  name: string;
  host_type: HostType;
  status: HostStatus;
  node: string;
  cpus: number;
  memory_mb: number;
  disk_gb: number;
  uptime: number;
  deploy_status: DeployStatus | null;
  deployed_keys: number;
}

export interface SSHKey {
  id: number;
  name: string;
  public_key: string;
  fingerprint: string;
  is_default: boolean;
  created_at: string;
}

export interface SSHKeyCreate {
  name: string;
  public_key: string;
  is_default: boolean;
}

export interface DeployRequest {
  key_id: number;
  host_vmids: number[];
  user: string;
}

export interface DeployResult {
  vmid: number;
  host_name: string;
  success: boolean;
  message: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  target: string;
  detail: string;
  success: boolean;
  created_at: string;
}

export interface ConnectionStatus {
  ok: boolean;
  version?: string;
  release?: string;
  error?: string;
}
