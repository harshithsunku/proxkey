import { Wifi, WifiOff } from "lucide-react";
import { useConnection } from "../api/hooks";

export function ConnectionBadge() {
  const { data, isLoading } = useConnection();

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <div className="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
        Connecting...
      </span>
    );
  }

  if (!data?.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <WifiOff className="h-3.5 w-3.5" />
        Disconnected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
      <Wifi className="h-3.5 w-3.5" />
      PVE {data.version}
    </span>
  );
}
