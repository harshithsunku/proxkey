import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import * as api from "./client";
import type { SSHKeyCreate, DeployRequest, RevokeRequest } from "./types";

// Hosts
export function useHosts() {
  return useQuery({ queryKey: ["hosts"], queryFn: api.fetchHosts, refetchInterval: 15000 });
}

export function useConnection() {
  return useQuery({ queryKey: ["connection"], queryFn: api.checkConnection });
}

// SSH Keys
export function useKeys() {
  return useQuery({ queryKey: ["keys"], queryFn: api.fetchKeys });
}

export function useCreateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SSHKeyCreate) => api.createKey(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
}

export function useDeleteKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
}

// Deploy
export function useDeploy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DeployRequest) => api.deployKey(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hosts"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// Revoke
export function useRevoke() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RevokeRequest) => api.revokeKey(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hosts"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// Host Keys (batch)
export function useHostKeys(vmids: number[]) {
  return useQueries({
    queries: vmids.map((vmid) => ({
      queryKey: ["hostKeys", vmid],
      queryFn: () => api.fetchHostKeys(vmid),
      enabled: vmids.length > 0,
    })),
  });
}

// Audit
export function useAuditLog() {
  return useQuery({ queryKey: ["audit"], queryFn: api.fetchAuditLog });
}

// Stats
export function useStats() {
  return useQuery({ queryKey: ["stats"], queryFn: api.fetchStats, refetchInterval: 30000 });
}
