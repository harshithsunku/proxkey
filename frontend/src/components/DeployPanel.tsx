import { useState } from "react";
import { Rocket, CheckCircle, XCircle, ShieldOff, Zap, Eye, Star, X } from "lucide-react";
import { useKeys, useDeploy, useRevoke, useHosts, useHostKeys } from "../api/hooks";
import { useAppStore } from "../store/app";
import type { DeployResult } from "../api/types";

type Mode = "deploy" | "revoke";

function InspectPanel({ vmids, onClose }: { vmids: number[]; onClose: () => void }) {
  const results = useHostKeys(vmids);

  const isLoading = results.some((r) => r.isLoading);

  return (
    <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-200">Deployed Keys</h4>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
          Loading...
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {results.map((r) => {
            const data = r.data;
            if (!data) return null;
            return (
              <div key={data.vmid} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-100">
                    {data.host_name || `VMID ${data.vmid}`}
                  </span>
                  <span className="text-xs text-slate-500">({data.vmid})</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {data.keys.length} key{data.keys.length !== 1 && "s"}
                  </span>
                </div>
                {data.keys.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No keys deployed</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.keys.map((k) => (
                      <div
                        key={k.key_id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {k.status === "deployed" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="font-medium text-slate-200">{k.key_name}</span>
                        {k.is_default && (
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                        )}
                        <code className="text-slate-500 truncate max-w-[180px]">{k.fingerprint}</code>
                        {k.deployed_at && (
                          <span className="ml-auto text-slate-600 shrink-0">
                            {new Date(k.deployed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DeployPanel() {
  const { selectedHosts, clearSelection, selectAllHosts } = useAppStore();
  const { data: keys } = useKeys();
  const { data: hosts } = useHosts();
  const deploy = useDeploy();
  const revoke = useRevoke();
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [results, setResults] = useState<DeployResult[] | null>(null);
  const [mode, setMode] = useState<Mode>("deploy");
  const [resultMode, setResultMode] = useState<Mode>("deploy");
  const [showInspect, setShowInspect] = useState(false);

  const handleDeploy = () => {
    if (!selectedKeyId || selectedHosts.length === 0) return;
    deploy.mutate(
      { key_id: selectedKeyId, host_vmids: selectedHosts, user: "root" },
      {
        onSuccess: (data) => {
          setResults(data);
          setResultMode("deploy");
          setShowInspect(false);
          clearSelection();
        },
      }
    );
  };

  const handleRevoke = () => {
    if (!selectedKeyId || selectedHosts.length === 0) return;
    revoke.mutate(
      { key_id: selectedKeyId, host_vmids: selectedHosts, user: "root" },
      {
        onSuccess: (data) => {
          setResults(data);
          setResultMode("revoke");
          setShowInspect(false);
          clearSelection();
        },
      }
    );
  };

  const selectAllRunning = () => {
    if (!hosts) return;
    const running = hosts.filter((h) => h.status === "running").map((h) => h.vmid);
    selectAllHosts(running);
  };

  if (selectedHosts.length === 0 && !results) return null;

  const isPending = deploy.isPending || revoke.isPending;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
      {results ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-100">
            {resultMode === "deploy" ? "Deployment" : "Revocation"} Results
          </h3>
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
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-300">
              <strong>{selectedHosts.length}</strong> host{selectedHosts.length !== 1 && "s"} selected
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

            {/* Mode Toggle */}
            <div className="flex rounded-lg border border-slate-600 overflow-hidden">
              <button
                onClick={() => setMode("deploy")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  mode === "deploy"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Deploy
              </button>
              <button
                onClick={() => setMode("revoke")}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  mode === "revoke"
                    ? "bg-red-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Revoke
              </button>
            </div>

            {mode === "deploy" ? (
              <button
                onClick={handleDeploy}
                disabled={!selectedKeyId || isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                <Rocket className="h-4 w-4" />
                {deploy.isPending ? "Deploying..." : "Deploy"}
              </button>
            ) : (
              <button
                onClick={handleRevoke}
                disabled={!selectedKeyId || isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition"
              >
                <ShieldOff className="h-4 w-4" />
                {revoke.isPending ? "Revoking..." : "Revoke"}
              </button>
            )}

            <button
              onClick={clearSelection}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 border-t border-slate-700/50 pt-2 mt-3">
            <span className="text-xs text-slate-500">Quick:</span>
            <button
              onClick={selectAllRunning}
              className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-white transition"
            >
              <Zap className="h-3 w-3" />
              Select all running
            </button>
            <button
              onClick={() => setShowInspect(!showInspect)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs transition ${
                showInspect
                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                  : "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Eye className="h-3 w-3" />
              Inspect keys
            </button>
          </div>

          {/* Inspect Panel */}
          {showInspect && (
            <InspectPanel vmids={selectedHosts} onClose={() => setShowInspect(false)} />
          )}
        </div>
      )}
    </div>
  );
}
