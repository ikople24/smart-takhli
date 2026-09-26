// models/flood-relief/FloodZone.js
// โซนสีที่เจ้าหน้าที่วาดเองบนแผนที่ (Geoman) — collection flood_zones
// level ตรวจด้วย lib/flood-relief/zones.ts · geometry ตรวจด้วย polygonError() ก่อนบันทึก
// ทุกการสร้าง/แก้/ปิด ต่อท้าย history และ re-assign โซนให้คำขอที่ยังไม่ปิดฝั่ง server
import mongoose from "mongoose";

const PolygonSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Polygon"], required: true },
    coordinates: { type: [[[Number]]], required: true },
  },
  { _id: false }
);

const HistorySchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    by: { type: String, default: "" },
    byClerkId: { type: String, default: "" },
    action: { type: String, required: true }, // create | update_geometry | update_level | rename | deactivate | activate
    detail: { type: String, default: "" },
  },
  { _id: false }
);

const FloodZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ชื่อชุมชน (โซนแบบเติมสี) หรือ A, B, C … (โซนที่วาดเอง — เลิกใช้เครื่องมือวาดแล้ว)
    // โซนแบบ "เติมสีทั้งชุมชน" (เจ้าของสั่ง 2026-09-26): geometry คัดลอกจาก basemap geojsonfeatures (อ่านอย่างเดียว)
    // หนึ่งชุมชนมีได้หนึ่งโซน · null = โซนที่วาดเองแบบเดิม
    communityName: { type: String, default: null },
    level: { type: String, required: true }, // critical | danger | watch | safe
    geometry: { type: PolygonSchema, required: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
    history: { type: [HistorySchema], default: [] },
  },
  { timestamps: true, collection: "flood_zones" }
);

FloodZoneSchema.index({ geometry: "2dsphere" });
FloodZoneSchema.index({ active: 1 });
FloodZoneSchema.index({ communityName: 1 });

export default mongoose.models.FloodZone || mongoose.model("FloodZone", FloodZoneSchema, "flood_zones");
