import { create } from "zustand";
import axios from "axios";

interface ProblemOption {
  _id: string;
  label: string;
  iconUrl: string;
  category: string;
  active: boolean;
}

interface ProblemOptionState {
  problemOptions: ProblemOption[];
  fetchProblemOptions: () => Promise<void>;
}

export const useProblemOptionStore = create<ProblemOptionState>((set) => ({
  problemOptions: [],

  fetchProblemOptions: async () => {
    try {
      const res = await axios.get("/api/problemoptions");
      set({ problemOptions: res.data });
    } catch (error) {
      console.error("Failed to fetch problem options:", error);
    }
  },
}));