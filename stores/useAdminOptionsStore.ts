import { create } from 'zustand';
interface AdminOption {
  _id: string;
  label: string;
  menu_category: string;
  option_url: string;
  active: boolean;
  createdAt: string;
}

interface AdminOptionsState {
  adminOptions: AdminOption[];
  setAdminOptions: (options: AdminOption[]) => void;
  addAdminOption: (option: AdminOption) => void;
  updateAdminOption: (id: string, updatedOption: Partial<AdminOption>) => void;
  removeAdminOption: (id: string) => void;
  fetchAdminOptions: () => void;
}

export const useAdminOptionsStore = create<AdminOptionsState>((set) => ({
  adminOptions: [],
  setAdminOptions: (options: AdminOption[]): void => set({ adminOptions: options }),
  addAdminOption: (option: AdminOption): void =>
    set((state) => ({
      adminOptions: [...state.adminOptions, option],
    })),
  updateAdminOption: (id: string, updatedOption: Partial<AdminOption>): void =>
    set((state) => ({
      adminOptions: state.adminOptions.map((opt) =>
        opt._id === id ? { ...opt, ...updatedOption } : opt
      ),
    })),
  removeAdminOption: (id: string): void =>
    set((state) => ({
      adminOptions: state.adminOptions.filter((opt) => opt._id !== id),
    })),
  fetchAdminOptions: async () => {
    try {
      const res = await fetch("/api/admin-options");
      const data = await res.json();
      set({ adminOptions: data });
      // console.log("✅ fetched admin options:", data); //debug:
    } catch (error) {
      console.error("❌ failed to fetch admin options:", error);
    }
  },
}));