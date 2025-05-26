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
  fetchComplaints: () => Promise<void>;
}

const useComplaintStore = create<ComplaintState>((set) => ({
  complaints: [],
  isLoading: false,
  error: null,
  fetchComplaints: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await axios.get<Complaint[]>('/api/complaints');
      set({ complaints: res.data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch', isLoading: false });
    }
  }
}));

export default useComplaintStore;