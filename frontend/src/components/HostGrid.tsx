import { useState } from "react";
import { Monitor, Container, Key, Check, Network, Terminal, Search, Filter } from "lucide-react";
import { useHosts } from "../api/hooks";
import { useAppStore } from "../store/app";
import { StatusBadge } from "./StatusBadge";
import type { HostInfo, HostType, HostStatus } from "../api/types";
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
  const [copiedSsh, setCopiedSsh] = useState(false);

  const primaryIp = host.ip_addresses[0] || null;

  const copySshCommand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!primaryIp) return;
    navigator.clipboard.writeText(`ssh root@${primaryIp}`);
    setCopiedSsh(true);
    setTimeout(() => setCopiedSsh(false), 2000);
  };

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

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <StatusBadge status={host.status} />
        {host.deployed_keys > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-400">
            <Key className="h-3 w-3" /> {host.deployed_keys}
          </span>
        )}
      </div>

      {/* IP Addresses */}
      {host.ip_addresses.length > 0 && (
        <div className="mb-3 flex items-start gap-1.5">
          <Network className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            {host.ip_addresses.map((ip) => (
              <span key={ip} className="text-xs font-mono text-cyan-400">{ip}</span>
            ))}
          </div>
        </div>
      )}

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

      {/* SSH Connect Button */}
      {primaryIp && (
        <button
          onClick={copySshCommand}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700/50 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
        >
          <Terminal className="h-3 w-3" />
          {copiedSsh ? "Copied!" : `ssh root@${primaryIp}`}
        </button>
      )}
    </div>
  );
}

type SortField = "vmid" | "name" | "status" | "uptime";
type FilterStatus = "all" | HostStatus;
type FilterType = "all" | HostType;

export function HostGrid() {
  const { data: hosts, isLoading, error } = useHosts();
  const { selectedHosts, selectAllHosts, clearSelection } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortField>("vmid");

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

  // Filter
  let filtered = hosts.filter((h) => {
    if (filterStatus !== "all" && h.status !== filterStatus) return false;
    if (filterType !== "all" && h.host_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = h.name.toLowerCase().includes(q);
      const matchesVmid = String(h.vmid).includes(q);
      const matchesIp = h.ip_addresses.some((ip) => ip.includes(q));
      if (!matchesName && !matchesVmid && !matchesIp) return false;
    }
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "name": return a.name.localeCompare(b.name);
      case "status": return a.status.localeCompare(b.status);
      case "uptime": return b.uptime - a.uptime;
      default: return a.vmid - b.vmid;
    }
  });

  const allVmids = filtered.map((h) => h.vmid);
  const allSelected = allVmids.length > 0 && allVmids.every((id) => selectedHosts.includes(id));

  return (
    <div>
      {/* Search and Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, VMID, or IP..."
            className="w-full rounded-lg border border-slate-600 bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="lxc">LXC</option>
            <option value="qemu">QEMU</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="vmid">Sort: VMID</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="uptime">Sort: Uptime</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {filtered.length} host{filtered.length !== 1 && "s"}
          {filtered.length !== hosts.length && ` (of ${hosts.length})`}
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
        {filtered.map((host) => (
          <HostCard key={host.vmid} host={host} />
        ))}
      </div>
    </div>
  );
}
