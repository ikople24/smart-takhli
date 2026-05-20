import mongoose from 'mongoose';

const SubmittedReportSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String },
  community: { type: String },
  problems: { type: [String], default: [] },
  category: {type:String},
  images: { type: [String], default: [] },
  detail: { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number }
  },
  complaintId : { type: String },
  status: { type: String },
  officer: { type: String },
  /** ซ่อนการ์ดจากหน้า complaint / status — แอดมินยังเห็นในระบบหลังบ้าน */
  isConfidential: { type: Boolean, default: false },
  /** PDPA: ภาพเบลอ + เซ็นเซอร์ข้อความสำหรับผู้ใช้ที่ไม่ใช่แอดมิน */
  pdpaSensitive: { type: Boolean, default: false },
  /** ช่วงตัวอักษรใน detail ที่ซ่อนต่อสาธารณะ (เจ้าหน้าที่กำหนด) — index ตาม JS string */
  pdpaDetailRedactions: {
    type: [
      {
        start: { type: Number, required: true },
        end: { type: Number, required: true },
      },
    ],
    default: [],
  },
  updatedAt: { type: Date },
  timestamp: { type: Date }
}, {
  collection: 'submittedreports', // ให้ตรงกับชื่อ collection ใน Compass
  timestamps: true // เพื่อให้ mongoose จัดการ createdAt / updatedAt ให้อัตโนมัติ
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);