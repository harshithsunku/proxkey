import { create } from "zustand";

type Tab = "dashboard" | "hosts" | "keys" | "audit";

interface AppState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  selectedHosts: number[];
  toggleHost: (vmid: number) => void;
  selectAllHosts: (vmids: number[]) => void;
  clearSelection: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: "dashboard",
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedHosts: [],
  toggleHost: (vmid) =>
    set((s) => ({
      selectedHosts: s.selectedHosts.includes(vmid)
        ? s.selectedHosts.filter((id) => id !== vmid)
        : [...s.selectedHosts, vmid],
    })),
  selectAllHosts: (vmids) => set({ selectedHosts: vmids }),
  clearSelection: () => set({ selectedHosts: [] }),
}));
