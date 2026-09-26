// models/flood-relief/FloodGauge.js
// จุดบนแผนที่ของศูนย์ฯ (collection flood_gauges — ชื่อเดิมตั้งแต่มีแค่จุดวัดน้ำ ห้ามเปลี่ยน)
//   kind "gauge"    = จุดวัดระดับน้ำ: อัปโหลดรูปเป็นระยะให้เห็นระดับน้ำจริง — เจ้าหน้าที่และประชาชน (หน้า /flood) ปักได้
//   kind "water"    = จุดแจกน้ำดื่ม · "donation" = จุดรับบริจาค — **เจ้าหน้าที่เท่านั้น** (กันจุดรับบริจาคปลอม)
// เอกสารเก่าไม่มี kind/source = gauge/staff (อ่านผ่าน pointKind/pointSource ใน lib/flood-relief/gauge.ts)
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
    source: { type: String, default: "staff" }, // staff | public
    clientIp: { type: String, default: "" }, // rate-limit รูปจากประชาชน — ห้ามส่งออก API
  },
  { _id: false }
);

const FloodGaugeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, default: "gauge" }, // gauge | water | donation
    source: { type: String, default: "staff" }, // ใครปักจุด: staff | public
    clientIp: { type: String, default: "" }, // rate-limit การปักจุดจากประชาชน — ห้ามส่งออก API
    location: { type: PointSchema, required: true },
    note: { type: String, default: "" }, // คำอธิบายจุด เช่น "สะพานข้ามคลองหน้าวัด ดูที่เสาตอม่อ"
    active: { type: Boolean, default: true },
    photos: { type: [PhotoSchema], default: [] }, // ใหม่สุดอยู่ท้าย
    lastPhotoUrl: { type: String, default: null },
    lastPhotoAt: { type: Date, default: null },
    lastLevelCm: { type: Number, default: null },
    lastNote: { type: String, default: "" },
    lastSource: { type: String, default: null }, // รูปล่าสุดมาจาก staff | public — หน้าสาธารณะติดป้าย "ภาพจากประชาชน"
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "flood_gauges" }
);

FloodGaugeSchema.index({ location: "2dsphere" });
FloodGaugeSchema.index({ active: 1 });
FloodGaugeSchema.index({ clientIp: 1, createdAt: -1 });
FloodGaugeSchema.index({ "photos.clientIp": 1, "photos.at": -1 });

export default mongoose.models.FloodGauge || mongoose.model("FloodGauge", FloodGaugeSchema, "flood_gauges");
