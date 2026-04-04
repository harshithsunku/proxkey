import { cn } from "../lib/utils";

const colors: Record<string, string> = {
  running: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  stopped: "bg-red-500/20 text-red-400 border-red-500/30",
  unknown: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  deployed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colors[status] || colors.unknown
      )}
    >
      {status}
    </span>
  );
}
