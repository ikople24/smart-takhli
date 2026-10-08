import mongoose from "mongoose";

// ทะเบียนหัวโบล์ (จุดที่ใช้โบตะกอน) — ตั้งต้นจากแอป Glide เดิม 203 จุด (สำรวจ ม.ค.–ก.พ. 2568)
// นำเข้าด้วย scripts/import-flush-points.mjs (upsert ตาม code) · ไม่เกี่ยวกับทะเบียนท่อ smart-water
// หมายเหตุ: ตัวอักษรนำหน้า code (AT/BP/CN) ในข้อมูลเดิมไม่ตรงกับชนิดจริง ~76 จุด — ใช้ kind ตัดสินชนิดเสมอ
const FlushPointSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    typeCode: { type: String, default: "" }, // type_head_bor เดิม (สอดคล้องกับ kind)
    kind: {
      type: String,
      enum: ["tee_large", "tee_medium", "tee_small", "garland", "unknown"],
      default: "unknown",
    },
    roadName: { type: String, default: "" },
    name: { type: String, default: "" },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    photoUrl: { type: String, default: "" }, // Cloudinary (ย้ายมาจาก Glide)
    photoSourceUrl: { type: String, default: "" }, // URL รูปต้นทางที่ Glide — ใช้กันอัปโหลดซ้ำ
    legacy: {
      system: { type: String, default: "" },
      rowId: { type: String, default: "" },
      surveyedAt: { type: Date, default: null },
      surveyedBy: { type: String, default: "" },
    },
    active: { type: Boolean, default: true },
  },
  { collection: "smart_papar_flush_points", timestamps: true }
);

FlushPointSchema.index({ code: 1 }, { unique: true });
FlushPointSchema.index({ location: "2dsphere" });

export default mongoose.models.FlushPoint || mongoose.model("FlushPoint", FlushPointSchema);
