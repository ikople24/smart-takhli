import mongoose from "mongoose";

// ทะเบียนบุคคล (ผู้ขอทุน) — 1 คน = 1 เอกสาร ข้ามปี
const SchoolApplicantSchema = new mongoose.Schema(
  {
    prefix: { type: String, default: "" },
    name: { type: String, required: true, index: true },
    phone: { type: String, default: "" }, // ข้อมูลติดต่อ + สัญญาณจัดกลุ่มครัวเรือน (ไม่ใช่ตัวยืนยันตัวตน)
    legacyApplicantId: { type: String, default: null }, // TKC-xxx เดิม
    legacyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // _id ใน educationregisters
  },
  { timestamps: true }
);

export default mongoose.models.SchoolApplicant ||
  mongoose.model("SchoolApplicant", SchoolApplicantSchema, "school_applicants");
