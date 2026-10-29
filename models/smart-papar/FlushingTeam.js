import mongoose from "mongoose";

// ทีมงานโบตะกอน (กองการประปา / ทีมงานป้องกัน) — members = ชื่อคนบันทึก (FlushingLog.createdByName) ตรงตัวหลัง trim
// ทีมของบันทึกหาตอนอ่านผ่าน lib/smart-papar/flushingSchedule.js#teamResolver — ไม่ประทับลง log
// ชื่อหนึ่งอยู่ได้ทีมเดียว (validateTeamsInput) · เอกสารตั้งต้นสร้างโดย lib/smart-papar/loadFlushingData.js#loadTeams
const FlushingTeamSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    order: { type: Number, default: 0 },
    members: { type: [String], default: [] },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_papar_flushing_teams", timestamps: true }
);

export default mongoose.models.FlushingTeam || mongoose.model("FlushingTeam", FlushingTeamSchema);
