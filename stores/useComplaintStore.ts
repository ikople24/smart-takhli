import { create } from 'zustand';
import axios from 'axios';

interface Complaint {
  _id: string;
  detail: string;
  category: string;
  problems: string[];
  images: string[];
  status: string;
  createdAt: string;
  completedAt?: string;
  complaintId?: string;
  community?: string;
  /** ซ่อนการ์ดจากหน้าสาธารณะ */
  isConfidential?: boolean;
  /** โหมด PDPA (เบลอรูป + เซ็นเซอร์ข้อความสำหรับผู้ใช้ที่ไม่ใช่แอดมิน) */
  pdpaSensitive?: boolean;
  /** ช่วงซ่อนคำใน detail (เจ้าหน้าที่กำหนด) */
  pdpaDetailRedactions?: { start: number; end: number }[];
  /** ตั้งโดย API เมื่อส่งข้อมูลที่ปิดบังแล้ว (หน้าประชาชน) */
  pdpaPublicSanitized?: boolean;
  location?: {
    lat: number;
    lng: number;
  };
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