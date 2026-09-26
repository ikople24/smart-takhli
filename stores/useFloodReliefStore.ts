// stores/useFloodReliefStore.ts — state ของแดชบอร์ดศูนย์ช่วยเหลือน้ำท่วม
// selectedId ใช้ร่วมกันระหว่างรายการซ้าย ↔ หมุดบนแผนที่ ↔ แผงขวา (README § Interactions)
import { create } from "zustand";

export type FloodFilter = "all" | "critical" | "evac" | "drain" | "sand" | "other";
export type FloodLayers = { requests: boolean; teams: boolean; communities: boolean };

type State = {
  selectedId: string | null;
  filter: FloodFilter;
  query: string;
  /** จอ < 1024px: สลับ รายการ / แผนที่ */
  mobileTab: "list" | "map";
  layers: FloodLayers;
  select: (id: string | null) => void;
  setFilter: (f: FloodFilter) => void;
  setQuery: (q: string) => void;
  setMobileTab: (t: "list" | "map") => void;
  toggleLayer: (k: keyof FloodLayers) => void;
};

export const useFloodReliefStore = create<State>((set) => ({
  selectedId: null,
  filter: "all",
  query: "",
  mobileTab: "list",
  layers: { requests: true, teams: true, communities: false },
  select: (id) => set({ selectedId: id }),
  setFilter: (filter) => set({ filter }),
  setQuery: (query) => set({ query }),
  setMobileTab: (mobileTab) => set({ mobileTab }),
  toggleLayer: (k) => set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
}));
