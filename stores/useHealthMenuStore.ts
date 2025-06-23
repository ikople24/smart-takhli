import { create } from "zustand";
import axios from "axios";

export interface MenuObHealth {
  label: string;
  image_icon: string;
  available: number;
}

interface HealthMenuStore {
  menu: MenuObHealth[];
  loading: boolean;
  fetchMenu: () => Promise<void>;
}

export const useHealthMenuStore = create<HealthMenuStore>((set) => ({
  menu: [],
  loading: false,
  fetchMenu: async () => {
    set({ loading: true });
    try {
      const res = await axios.get("/api/smart-health/available-count");
      set({
        menu: res.data,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to fetch available count:", err);
      set({ loading: false });
    }
  },
}));