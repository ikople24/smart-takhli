import mongoose from 'mongoose';

const SubmittedReportSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String },
  community: { type: String },
  problems: { type: [String], default: [] },
  images: { type: [String], default: [] },
  detail: { type: String },
  location: {
    lat: { type: Number },
    lng: { type: Number },
    status: { type: String },
    officer: { type: String }
  },
  updatedAt: { type: Date },
  timestamp: { type: Date }
}, {
  collection: 'submittedreports', // ให้ตรงกับชื่อ collection ใน Compass
  timestamps: true // เพื่อให้ mongoose จัดการ createdAt / updatedAt ให้อัตโนมัติ
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);