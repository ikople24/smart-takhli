import mongoose from "mongoose";

// บันทึกงานโบตะกอน (ระบายตะกอนในท่อ) ของเจ้าหน้าที่หน้างาน — 1 doc = 1 ครั้งที่โบ
// ไม่ผูกกับเรื่องร้องเรียนหรือทะเบียนท่อ (smart-water) · เขียนผ่าน API ที่ validate ด้วย lib/smart-papar/flushing.js เท่านั้น
const FlushingLogSchema = new mongoose.Schema(
  {
    flushedAt: { type: Date, required: true },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    locationName: { type: String, required: true, trim: true },
    durationMin: { type: Number, required: true },
    turbidityBeforeNtu: { type: Number, default: null },
    turbidityAfterNtu: { type: Number, default: null },
    result: { type: String, enum: ["clear", "still_turbid"], required: true },
    photosBefore: { type: [String], default: [] },
    photosAfter: { type: [String], default: [] },
    note: { type: String, default: "" },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { collection: "smart_papar_flushing_logs", timestamps: true }
);

FlushingLogSchema.index({ deletedAt: 1, flushedAt: -1 });
FlushingLogSchema.index({ location: "2dsphere" });

export default mongoose.models.FlushingLog ||
  mongoose.model("FlushingLog", FlushingLogSchema);
