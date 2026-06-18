import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    visitNo: { type: Number, required: true, min: 1, max: 16 },
    dateISO: { type: String, required: true }, // YYYY-MM-DD (Asia/Bangkok)
    note: { type: String, default: null },
  },
  { _id: false }
);

const ElderlySchoolScheduleSchema = new mongoose.Schema(
  {
    yearBE: { type: Number, required: true, unique: true, index: true },
    sessions: { type: [SessionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.ElderlySchoolSchedule ||
  mongoose.model("ElderlySchoolSchedule", ElderlySchoolScheduleSchema, "elderly_school_schedules");


