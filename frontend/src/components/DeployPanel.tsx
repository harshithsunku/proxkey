import { useState } from "react";
import { Rocket, CheckCircle, XCircle } from "lucide-react";
import { useKeys, useDeploy } from "../api/hooks";
import { useAppStore } from "../store/app";
import type { DeployResult } from "../api/types";

export function DeployPanel() {
  const { selectedHosts, clearSelection } = useAppStore();
  const { data: keys } = useKeys();
  const deploy = useDeploy();
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [results, setResults] = useState<DeployResult[] | null>(null);

  const handleDeploy = () => {
    if (!selectedKeyId || selectedHosts.length === 0) return;
    deploy.mutate(
      { key_id: selectedKeyId, host_vmids: selectedHosts, user: "root" },
      {
        onSuccess: (data) => {
          setResults(data);
          clearSelection();
        },
      }
    );
  };

  if (selectedHosts.length === 0 && !results) return null;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
      {results ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Deployment Results</h3>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.vmid} className="flex items-center gap-2 text-sm">
                {r.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <span className="font-medium text-slate-200">{r.host_name}</span>
                <span className="text-slate-500">({r.vmid})</span>
                <span className={r.success ? "text-emerald-400" : "text-red-400"}>{r.message}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setResults(null)}
            className="mt-3 text-xs text-slate-400 hover:text-slate-300"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300">
            Deploy to <strong>{selectedHosts.length}</strong> host{selectedHosts.length !== 1 && "s"}:
          </span>
          <select
            value={selectedKeyId ?? ""}
            onChange={(e) => setSelectedKeyId(Number(e.target.value) || null)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select a key...</option>
            {keys?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} {k.is_default ? "(default)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleDeploy}
            disabled={!selectedKeyId || deploy.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            <Rocket className="h-4 w-4" />
            {deploy.isPending ? "Deploying..." : "Deploy"}
          </button>
          <button
            onClick={clearSelection}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
