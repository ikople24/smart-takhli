import mongoose from "mongoose";

// การลงทะเบียนเรียนรายปี (คน × ปี) — ทำให้ผู้สมัครที่ยังไม่มีผลวัดขึ้นในทะเบียน/บัตร QR ของปีนั้น
// ผู้เรียนของปี = มีเอกสารที่นี่ "หรือ" มี elderly_visits ของปีนั้น (ปีเก่าก่อน 2570 ไม่มีเอกสารที่นี่ ไม่ต้อง migrate)
// อ่านผ่าน lib/elderly-school/enrollment.js#yearPersonIds เท่านั้น
const ElderlyEnrollmentSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: "ElderlyPerson", required: true },
    yearBE: { type: Number, required: true, index: true },
    source: { type: String, default: null }, // เช่น "sheet2570"
  },
  { timestamps: true }
);

ElderlyEnrollmentSchema.index({ personId: 1, yearBE: 1 }, { unique: true });

export default mongoose.models.ElderlyEnrollment ||
  mongoose.model("ElderlyEnrollment", ElderlyEnrollmentSchema, "elderly_enrollments");
