import { create } from 'zustand';
import axios from 'axios';

interface Complaint {
  _id: string;
  detail: string;
  // เพิ่ม field อื่น ๆ ตาม schema ที่ใช้
}

interface ComplaintState {
  complaints: Complaint[];
  isLoading: boolean;
  error: string | null;
  fetchComplaints: (status?: string) => Promise<void>;
}

const useComplaintStore = create<ComplaintState>((set) => ({
  complaints: [],
  isLoading: false,
  error: null,
  fetchComplaints: async (status?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = status ? `/api/complaints?status=${encodeURIComponent(status)}` : '/api/complaints';
      const res = await axios.get<Complaint[]>(url);
      console.log("(store) fetched complaints ✅", res.data);
      set({ complaints: res.data, isLoading: false });
    } catch (err: any) {
      console.error("(store) fetch error ❌", err.message);
      set({ error: err.message || 'Failed to fetch', isLoading: false });
    }
  }
}));

export default useComplaintStore;