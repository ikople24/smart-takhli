import mongoose from 'mongoose';

/** หลักฐานการยอมรับข้อตกลงก่อนแจ้งเรื่อง (จอ consent บน /report)
 *  ห่อเป็น sub-schema ปิด _id — ถ้าใส่เป็น plain object mongoose จะแถม _id ให้ทุกเอกสาร
 *  ⚠️ ต้องมีเหมือนกันใน models/SubmittedReport.js (schema ซ้ำสองไฟล์ ชื่อ model เดียวกัน) */
const ConsentSchema = new mongoose.Schema(
  {
    version: { type: String, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { _id: false }
);

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
  /** กองที่รับผิดชอบ — ชื่อมาตรฐานจาก lib/tasks/departments.js (คัดแยกจากหน้ากองงานรอรับ); '' = ยังไม่ระบุกอง
   *  ไม่ใช้ ref Organization เพราะ collection organizations เก็บแค่ตัวเทศบาล ไม่ใช่รายชื่อกอง
   *  ⚠️ ฟิลด์นี้ต้องมีใน models/SubmittedReport.js ด้วย (schema ซ้ำสองไฟล์ ชื่อ model เดียวกัน) */
  department: { type: String, default: '' },
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
  consent: { type: ConsentSchema, default: undefined },
  updatedAt: { type: Date },
  timestamp: { type: Date }
}, {
  collection: 'submittedreports', // ให้ตรงกับชื่อ collection ใน Compass
  timestamps: true // เพื่อให้ mongoose จัดการ createdAt / updatedAt ให้อัตโนมัติ
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);