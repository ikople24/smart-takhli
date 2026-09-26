// models/flood-relief/FloodTeam.js
// ทีมปฏิบัติงาน — collection flood_teams
// department ใช้ชื่อกองมาตรฐานจาก lib/tasks/departments.js (normalizeDepartment) ไม่ใช่ Organization
// ตำแหน่งล่าสุดอัปเดตจาก LIFF/LINE ในเฟสถัดไป — ยังไม่มีตำแหน่ง = ไม่มีฟิลด์ (2dsphere ข้ามเอกสารที่ไม่มีฟิลด์)
import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const FloodTeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // เช่น "ทีม ปภ. 1"
    department: { type: String, default: "" },
    equipment: { type: String, default: "" }, // เช่น "เรือท้องแบน · รถยก"
    lineGroupId: { type: String, default: "" }, // แจ้งทีมเมื่อถูกมอบหมาย
    lastLocation: { type: PointSchema, default: undefined },
    lastLocationAt: { type: Date, default: null },
    status: { type: String, enum: ["idle", "busy"], default: "idle" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "flood_teams" }
);

FloodTeamSchema.index({ lastLocation: "2dsphere" });

export default mongoose.models.FloodTeam || mongoose.model("FloodTeam", FloodTeamSchema, "flood_teams");
