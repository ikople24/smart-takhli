import mongoose from "mongoose";

// บันทึกการเปิดดู/พิมพ์ข้อมูลสุขภาพรายคนเพื่อส่งต่อ (เช่น สรุปสำหรับแพทย์) — PDPA: ตรวจย้อนหลังได้ว่าใครเปิดเมื่อไหร่
const ElderlyAccessLogSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: "ElderlyPerson", required: true, index: true },
    action: { type: String, required: true }, // "doctor-summary"
    userId: { type: String, required: true, index: true }, // Clerk userId
    at: { type: Date, default: () => new Date(), index: true },
  },
  { versionKey: false }
);

export default mongoose.models.ElderlyAccessLog ||
  mongoose.model("ElderlyAccessLog", ElderlyAccessLogSchema, "elderly_access_logs");
