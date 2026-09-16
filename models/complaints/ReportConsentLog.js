import mongoose from "mongoose";

// หลักฐานการกดยอมรับข้อตกลงก่อนแจ้งเรื่อง — เขียนทันทีที่ผู้ใช้กดยอมรับ
// (อีกชั้นคือฟิลด์ consent บนตัวเรื่องเอง ดู models/Complaint.js)
//
// ⚠️ เขียนได้โดยไม่ต้องล็อกอิน (ผู้แจ้งไม่มีบัญชี) จึงเก็บให้น้อยที่สุด:
// ไม่เก็บ IP ไม่เก็บ user-agent ไม่เก็บชื่อ/เบอร์ และไม่มีทางอ่านฝั่งสาธารณะ
//
// acceptedAt คือเวลาที่เครื่องผู้ใช้อ้าง ส่วน createdAt คือเวลาที่เซิร์ฟเวอร์รับจริง
// ใช้ createdAt เป็นหลักฐานหลักเมื่อสองค่าขัดกัน
const ReportConsentLogSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
    /** รหัสสุ่มจากเบราว์เซอร์ ไม่ผูกกับตัวบุคคล ใช้กันแถวซ้ำ */
    deviceId: { type: String, required: true },
    appId: { type: String, default: "" },
  },
  { collection: "report_consent_logs", timestamps: true }
);

// 1 อุปกรณ์ + 1 ฉบับ = 1 แถว — ยิงซ้ำกี่ครั้งก็ upsert ทับตัวเดิม
ReportConsentLogSchema.index({ deviceId: 1, version: 1 }, { unique: true });

export default mongoose.models.ReportConsentLog ||
  mongoose.model("ReportConsentLog", ReportConsentLogSchema);
