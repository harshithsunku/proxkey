import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LayoutDashboard, KeyRound, Server, ScrollText } from "lucide-react";
import { useAppStore } from "./store/app";
import { Dashboard } from "./components/Dashboard";
import { HostGrid } from "./components/HostGrid";
import { KeyManager } from "./components/KeyManager";
import { AuditLog } from "./components/AuditLog";
import { DeployPanel } from "./components/DeployPanel";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { cn } from "./lib/utils";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const tabs = [
  { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "hosts" as const, label: "Hosts", icon: Server },
  { id: "keys" as const, label: "SSH Keys", icon: KeyRound },
  { id: "audit" as const, label: "Audit Log", icon: ScrollText },
];

function AppContent() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <KeyRound className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ProxKey</h1>
              <p className="text-xs text-slate-500">SSH Key Manager for Proxmox</p>
            </div>
          </div>
          <ConnectionBadge />
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl gap-1 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition",
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "hosts" && (
          <div className="space-y-4">
            <DeployPanel />
            <HostGrid />
          </div>
        )}
        {activeTab === "keys" && <KeyManager />}
        {activeTab === "audit" && <AuditLog />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
