// models/flood-relief/FloodGauge.js
// จุดวัดระดับน้ำ — ปักหมุดจุดสำคัญ (สะพาน ถนนสายหลัก ฯลฯ) แล้วเจ้าหน้าที่อัปโหลดรูปเป็นระยะให้เห็นระดับน้ำจริง (collection flood_gauges)
// รูป/ระดับล่าสุดคัดลอกไว้ที่ last* ให้ list/หน้าสาธารณะอ่านเร็วโดยไม่ต้องไล่ array · ประวัติเก็บ MAX_GAUGE_PHOTOS รูปล่าสุด
// ⚠️ รูปแสดงบนหน้าสาธารณะ /flood — ชื่อผู้อัปโหลด (by) ห้ามส่งออก API สาธารณะ
import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const PhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // Cloudinary เท่านั้น (ตรวจที่ lib/flood-relief/gauge.ts)
    at: { type: Date, required: true },
    levelCm: { type: Number, default: null }, // ระดับน้ำ (ซม.) ไม่บังคับ
    note: { type: String, default: "" },
    by: { type: String, default: "" },
    byClerkId: { type: String, default: "" },
  },
  { _id: false }
);

const FloodGaugeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: PointSchema, required: true },
    note: { type: String, default: "" }, // คำอธิบายจุด เช่น "สะพานข้ามคลองหน้าวัด ดูที่เสาตอม่อ"
    active: { type: Boolean, default: true },
    photos: { type: [PhotoSchema], default: [] }, // ใหม่สุดอยู่ท้าย
    lastPhotoUrl: { type: String, default: null },
    lastPhotoAt: { type: Date, default: null },
    lastLevelCm: { type: Number, default: null },
    lastNote: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "flood_gauges" }
);

FloodGaugeSchema.index({ location: "2dsphere" });
FloodGaugeSchema.index({ active: 1 });

export default mongoose.models.FloodGauge || mongoose.model("FloodGauge", FloodGaugeSchema, "flood_gauges");
