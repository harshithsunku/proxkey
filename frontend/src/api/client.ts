import type {
  HostInfo,
  SSHKey,
  SSHKeyCreate,
  DeployRequest,
  DeployResult,
  RevokeRequest,
  AuditLogEntry,
  ConnectionStatus,
  Stats,
  HostKeysResponse,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Hosts
export const fetchHosts = () => request<HostInfo[]>("/hosts");
export const checkConnection = () => request<ConnectionStatus>("/hosts/connection");
export const fetchHostKeys = (vmid: number) => request<HostKeysResponse>(`/hosts/${vmid}/keys`);

// SSH Keys
export const fetchKeys = () => request<SSHKey[]>("/keys");
export const createKey = (data: SSHKeyCreate) =>
  request<SSHKey>("/keys", { method: "POST", body: JSON.stringify(data) });
export const deleteKey = (id: number) =>
  request<void>(`/keys/${id}`, { method: "DELETE" });

// Deploy
export const deployKey = (data: DeployRequest) =>
  request<DeployResult[]>("/deploy", { method: "POST", body: JSON.stringify(data) });
export const revokeKey = (data: RevokeRequest) =>
  request<DeployResult[]>("/deploy/revoke", { method: "POST", body: JSON.stringify(data) });
export const fetchAuditLog = () => request<AuditLogEntry[]>("/deploy/audit");
export const fetchStats = () => request<Stats>("/deploy/stats");
