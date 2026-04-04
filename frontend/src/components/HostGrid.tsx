import { Monitor, Container, Key, Check } from "lucide-react";
import { useHosts } from "../api/hooks";
import { useAppStore } from "../store/app";
import { StatusBadge } from "./StatusBadge";
import type { HostInfo } from "../api/types";
import { cn } from "../lib/utils";

function formatUptime(seconds: number): string {
  if (seconds === 0) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function HostCard({ host }: { host: HostInfo }) {
  const { selectedHosts, toggleHost } = useAppStore();
  const selected = selectedHosts.includes(host.vmid);
  const Icon = host.host_type === "lxc" ? Container : Monitor;

  return (
    <div
      onClick={() => toggleHost(host.vmid)}
      className={cn(
        "relative cursor-pointer rounded-xl border p-4 transition-all",
        "bg-slate-800/50 hover:bg-slate-800",
        selected
          ? "border-indigo-500 ring-1 ring-indigo-500/50"
          : "border-slate-700 hover:border-slate-600"
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2 rounded-full bg-indigo-500 p-0.5">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-400" />
        <span className="text-xs font-mono text-slate-500">{host.host_type.toUpperCase()} {host.vmid}</span>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-slate-100 truncate">{host.name}</h3>

      <div className="mb-3 flex items-center gap-2">
        <StatusBadge status={host.status} />
        {host.deployed_keys > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-400">
            <Key className="h-3 w-3" /> {host.deployed_keys}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div>
          <span className="block text-slate-500">CPU</span>
          {host.cpus || "-"}
        </div>
        <div>
          <span className="block text-slate-500">RAM</span>
          {host.memory_mb ? `${host.memory_mb}M` : "-"}
        </div>
        <div>
          <span className="block text-slate-500">Up</span>
          {formatUptime(host.uptime)}
        </div>
      </div>
    </div>
  );
}

export function HostGrid() {
  const { data: hosts, isLoading, error } = useHosts();
  const { selectedHosts, selectAllHosts, clearSelection } = useAppStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
        <span className="ml-3">Discovering hosts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
        Failed to load hosts: {(error as Error).message}
      </div>
    );
  }

  if (!hosts?.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
        No hosts found. Check your Proxmox API connection.
      </div>
    );
  }

  const allVmids = hosts.map((h) => h.vmid);
  const allSelected = allVmids.length > 0 && allVmids.every((id) => selectedHosts.includes(id));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {hosts.length} host{hosts.length !== 1 && "s"} found
          {selectedHosts.length > 0 && (
            <span className="ml-2 text-indigo-400">({selectedHosts.length} selected)</span>
          )}
        </p>
        <button
          onClick={() => (allSelected ? clearSelection() : selectAllHosts(allVmids))}
          className="text-xs text-indigo-400 hover:text-indigo-300"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {hosts.map((host) => (
          <HostCard key={host.vmid} host={host} />
        ))}
      </div>
    </div>
  );
}
