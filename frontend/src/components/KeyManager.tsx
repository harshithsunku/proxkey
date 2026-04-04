import { useState } from "react";
import { Plus, Trash2, Star, Copy } from "lucide-react";
import { useKeys, useCreateKey, useDeleteKey } from "../api/hooks";

export function KeyManager() {
  const { data: keys, isLoading } = useKeys();
  const createKey = useCreateKey();
  const deleteKey = useDeleteKey();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createKey.mutate(
      { name, public_key: publicKey, is_default: isDefault },
      {
        onSuccess: () => {
          setName("");
          setPublicKey("");
          setIsDefault(false);
          setShowForm(false);
        },
      }
    );
  };

  const copyFingerprint = (id: number, fp: string) => {
    navigator.clipboard.writeText(fp);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (isLoading) {
    return <div className="py-10 text-center text-slate-400">Loading keys...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {keys?.length || 0} key{keys?.length !== 1 && "s"} stored
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          <Plus className="h-4 w-4" /> Add Key
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. laptop, workstation"
              required
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-slate-400">Public Key</label>
            <textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="ssh-ed25519 AAAA... user@host"
              required
              rows={3}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="is-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-slate-600"
            />
            <label htmlFor="is-default" className="text-sm text-slate-400">
              Set as default (auto-inject on new containers)
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createKey.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {createKey.isPending ? "Saving..." : "Save Key"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
          </div>
          {createKey.isError && (
            <p className="mt-2 text-sm text-red-400">{(createKey.error as Error).message}</p>
          )}
        </form>
      )}

      <div className="space-y-2">
        {keys?.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{key.name}</h3>
                {key.is_default && (
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <code className="text-xs text-slate-500 truncate max-w-[300px]">{key.fingerprint}</code>
                <button
                  onClick={() => copyFingerprint(key.id, key.fingerprint)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <Copy className="h-3 w-3" />
                </button>
                {copied === key.id && <span className="text-xs text-emerald-400">Copied!</span>}
              </div>
              <p className="mt-1 text-xs text-slate-600 font-mono truncate max-w-[500px]">
                {key.public_key}
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete key "${key.name}"?`)) deleteKey.mutate(key.id);
              }}
              className="ml-4 rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
