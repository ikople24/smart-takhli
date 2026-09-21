import mongoose from "mongoose";

// ทะเบียนบุคคล (ผู้ขอทุน) — 1 คน = 1 เอกสาร ข้ามปี
const SchoolApplicantSchema = new mongoose.Schema(
  {
    prefix: { type: String, default: "" },
    name: { type: String, required: true, index: true },
    phone: { type: String, default: "" }, // ข้อมูลติดต่อ + สัญญาณจัดกลุ่มครัวเรือน (ไม่ใช่ตัวยืนยันตัวตน)
    // เลขบัตรประชาชน 13 หลัก digits-only — เจ้าหน้าที่ backfill ฝั่งแอดมิน (spec 2026-07-15)
    // คนยังไม่มีเลข = ไม่มีฟิลด์ (undefined) ห้ามเซ็ต ""/null ไม่งั้น unique sparse ชนกันเอง
    citizenId: { type: String },
    legacyApplicantId: { type: String, default: null }, // TKC-xxx เดิม
    legacyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // _id ใน educationregisters
  },
  { timestamps: true }
);

SchoolApplicantSchema.index({ citizenId: 1 }, { unique: true, sparse: true });

export default mongoose.models.SchoolApplicant ||
  mongoose.model("SchoolApplicant", SchoolApplicantSchema, "school_applicants");
