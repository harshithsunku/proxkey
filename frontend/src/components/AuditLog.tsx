import { CheckCircle, XCircle } from "lucide-react";
import { useAuditLog } from "../api/hooks";

export function AuditLog() {
  const { data: logs, isLoading } = useAuditLog();

  if (isLoading) {
    return <div className="py-10 text-center text-slate-400">Loading audit log...</div>;
  }

  if (!logs?.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8 text-center text-slate-400">
        No audit log entries yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800 text-xs text-slate-400">
          <tr>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Target</th>
            <th className="px-4 py-3">Detail</th>
            <th className="px-4 py-3">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {logs.map((entry) => (
            <tr key={entry.id} className="bg-slate-800/30 hover:bg-slate-800/60 transition">
              <td className="px-4 py-3">
                {entry.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-300">{entry.action}</td>
              <td className="px-4 py-3 text-slate-200">{entry.target}</td>
              <td className="px-4 py-3 text-slate-400 truncate max-w-[300px]">{entry.detail}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(entry.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
