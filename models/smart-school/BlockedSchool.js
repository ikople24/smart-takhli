import mongoose from "mongoose";

// รายชื่อโรงเรียนที่ "ไม่ผ่านเกณฑ์" (เอกชน/นอกเขต) — แอดมินเพิ่ม/ลบเอง
// โรงเรียนที่ไม่อยู่ในลิสต์นี้ถือว่า ok โดยปริยาย (ไม่มี whitelist)
const BlockedSchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // normalize แล้ว
    reason: { type: String, enum: ["private", "out-of-district", "other"], default: "private" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.BlockedSchool ||
  mongoose.model("BlockedSchool", BlockedSchoolSchema, "school_blocked_schools");
