import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./client";
import type { SSHKeyCreate, DeployRequest } from "./types";

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
    },
  });
}

// Audit
export function useAuditLog() {
  return useQuery({ queryKey: ["audit"], queryFn: api.fetchAuditLog });
}
