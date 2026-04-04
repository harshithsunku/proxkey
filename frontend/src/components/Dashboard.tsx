import { Server, KeyRound, Rocket, ShieldCheck, Container, Monitor, Activity, TrendingUp } from "lucide-react";
import { useStats } from "../api/hooks";
import { cn } from "../lib/utils";

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className={cn("rounded-lg p-2", color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-700">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Dashboard() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
        <span className="ml-3">Loading dashboard...</span>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Total Hosts"
          value={stats.total_hosts}
          subValue={`${stats.running_hosts} running, ${stats.stopped_hosts} stopped`}
          icon={Server}
          color="bg-blue-500/20 text-blue-400"
        />
        <StatCard
          label="SSH Keys"
          value={stats.total_keys}
          subValue={stats.default_keys > 0 ? `${stats.default_keys} default` : "No default set"}
          icon={KeyRound}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          label="Deployments"
          value={stats.successful_deployments}
          subValue={stats.failed_deployments > 0 ? `${stats.failed_deployments} failed` : "All successful"}
          icon={Rocket}
          color="bg-emerald-500/20 text-emerald-400"
        />
        <StatCard
          label="Coverage"
          value={`${stats.coverage_percent}%`}
          subValue={`${stats.hosts_with_keys} of ${stats.total_hosts} hosts have keys`}
          icon={ShieldCheck}
          color="bg-amber-500/20 text-amber-400"
        />
      </div>

      {/* Detailed Panels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Host Breakdown */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Host Breakdown</h3>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1"><Container className="h-3 w-3" /> LXC Containers</span>
                <span className="text-slate-300">{stats.lxc_count}</span>
              </div>
              <ProgressBar value={stats.lxc_count} max={stats.total_hosts} color="bg-blue-500" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1"><Monitor className="h-3 w-3" /> QEMU VMs</span>
                <span className="text-slate-300">{stats.qemu_count}</span>
              </div>
              <ProgressBar value={stats.qemu_count} max={stats.total_hosts} color="bg-violet-500" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Running</span>
                <span className="text-emerald-400">{stats.running_hosts}</span>
              </div>
              <ProgressBar value={stats.running_hosts} max={stats.total_hosts} color="bg-emerald-500" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Stopped</span>
                <span className="text-red-400">{stats.stopped_hosts}</span>
              </div>
              <ProgressBar value={stats.stopped_hosts} max={stats.total_hosts} color="bg-red-500" />
            </div>
          </div>
        </div>

        {/* Key Coverage */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Key Coverage</h3>
          </div>

          <div className="flex items-center justify-center py-4">
            <div className="relative h-32 w-32">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeDasharray={`${stats.coverage_percent}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{stats.coverage_percent}%</span>
                <span className="text-xs text-slate-500">covered</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Hosts with keys</span>
              <span className="text-emerald-400">{stats.hosts_with_keys}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Hosts without keys</span>
              <span className="text-amber-400">{stats.total_hosts - stats.hosts_with_keys}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total deployments</span>
              <span className="text-slate-300">{stats.total_deployments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
