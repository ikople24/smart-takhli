import mongoose from "mongoose";

// ตรวจ/ทำความสะอาดค่าก่อนบันทึกที่ lib/elderly-school/schedule.js (normalizeSessions/normalizeDefaults)
const SessionSchema = new mongoose.Schema(
  {
    visitNo: { type: Number, required: true, min: 1, max: 16 },
    dateISO: { type: String, required: true }, // YYYY-MM-DD (Asia/Bangkok)
    note: { type: String, default: null }, // หัวข้อกิจกรรม
    // ว่าง = ใช้ค่าเริ่มต้นของปี (defaults) — เพิ่ม 2026-10
    startTime: { type: String, default: null }, // HH:MM
    endTime: { type: String, default: null }, // HH:MM
    location: { type: String, default: null },
    prepare: { type: String, default: null }, // สิ่งที่ผู้เรียนควรเตรียมมา
  },
  { _id: false }
);

const DefaultsSchema = new mongoose.Schema(
  {
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    location: { type: String, default: null },
  },
  { _id: false }
);

const ElderlySchoolScheduleSchema = new mongoose.Schema(
  {
    yearBE: { type: Number, required: true, unique: true, index: true },
    defaults: { type: DefaultsSchema, default: () => ({}) },
    sessions: { type: [SessionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.ElderlySchoolSchedule ||
  mongoose.model("ElderlySchoolSchedule", ElderlySchoolScheduleSchema, "elderly_school_schedules");
