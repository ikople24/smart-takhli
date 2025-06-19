import { create } from "zustand";
import axios from "axios";

interface MenuObHealth {
  _id: string;
  ob_type: string;
  id_code_th: string;
  image_icon: string;
  shot_name: string;
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
      const res = await axios.get("/api/smart-health/menu-ob-health"); // ต้องมี API นี้
      set({ menu: res.data, loading: false });
    } catch (err) {
      console.error("Failed to fetch health menu:", err);
      set({ loading: false });
    }
  },
}));