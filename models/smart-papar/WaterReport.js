import mongoose from "mongoose";

// เรื่องแจ้งปัญหาน้ำประปาจากประชาชน (/papar/report) — ไม่ผูกระบบร้องเรียน/มอบหมายงาน (เจ้าของเลือก 2026-10-16)
// แจ้งเข้ากลุ่ม LINE เจ้าหน้าที่เดิม · ticket สุ่ม (lib/smart-papar/waterReport.js#newWaterTicket) เดาเลขคนอื่นไม่ได้
// phone/fullName/clientIp เป็นข้อมูลส่วนบุคคล — ห้ามส่งออก API สาธารณะ
const WaterReportSchema = new mongoose.Schema(
  {
    ticket: { type: String, required: true },
    symptoms: { type: [String], required: true }, // keys ของ WATER_SYMPTOMS
    since: { type: String, required: true }, // key ของ WATER_SINCE
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    accuracyM: { type: Number, default: null },
    communityName: { type: String, default: null }, // จาก geojsonfeatures ตามพิกัด (อ่านอย่างเดียว)
    addressNote: { type: String, default: "" },
    photos: { type: [String], default: [] },
    prefix: { type: String, default: "" },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    consentAt: { type: Date, required: true },
    status: { type: String, enum: ["new", "done"], default: "new" },
    lineNotifiedAt: { type: Date, default: null }, // null = ส่ง LINE ไม่สำเร็จ/ไม่ได้ตั้งค่ากลุ่ม
    clientIp: { type: String, default: "" },
  },
  { collection: "smart_papar_water_reports", timestamps: true }
);

WaterReportSchema.index({ ticket: 1 }, { unique: true });
WaterReportSchema.index({ createdAt: -1 });
WaterReportSchema.index({ clientIp: 1, createdAt: -1 });
WaterReportSchema.index({ phone: 1, createdAt: -1 });
WaterReportSchema.index({ location: "2dsphere" });

export default mongoose.models.WaterReport || mongoose.model("WaterReport", WaterReportSchema);
