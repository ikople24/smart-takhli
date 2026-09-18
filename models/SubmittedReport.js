import mongoose from 'mongoose';

/** หลักฐานการยอมรับข้อตกลงก่อนแจ้งเรื่อง — ต้องตรงกับ models/Complaint.js */
const ConsentSchema = new mongoose.Schema(
  {
    version: { type: String, default: '' },
    acceptedAt: { type: Date, default: null },
  },
  { _id: false }
);

const SubmittedReportSchema = new mongoose.Schema({

  fullName: String,
  phone: String,
  community: String,
  problems: [String],
  category: String,
  images: [String],
  detail: String,
  location: {
    lat: Number,
    lng: Number,
  },
  prefix: String,
  address: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  complaintId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'อยู่ระหว่างดำเนินการ',
  },
  officer: {
    type: String,
    default: 'on',
  },
  /** กองที่รับผิดชอบ (ชื่อมาตรฐานจาก lib/tasks/departments.js) — ต้องตรงกับ models/Complaint.js (schema ซ้ำสองไฟล์) */
  department: { type: String, default: '' },
  isConfidential: { type: Boolean, default: false },
  pdpaSensitive: { type: Boolean, default: false },
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
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // LINE OA Integration — เก็บ LINE userId เมื่อ user ติดต่อผ่าน LINE Bot
  lineUserId: {
    type: String,
    default: null,
  },
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);