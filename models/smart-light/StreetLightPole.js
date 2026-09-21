import mongoose from "mongoose";

// ทะเบียนเสาไฟสาธารณะ — 1 เอกสาร = 1 ต้น (โมดูล smart-light กองช่าง)
// ประวัติสำรวจ embedded ในเอกสารเสา (จำนวนครั้งต่อเสาต่ำ ไม่คุ้มแยก collection)
const SurveyEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["normal", "damaged", "off"],
      required: true,
    },
    photoUrl: { type: String, default: "" },
    note: { type: String, default: "" },
    surveyedAt: { type: Date, required: true },
    surveyedBy: { type: String, default: "" }, // ชื่อผู้สำรวจ
    surveyedByClerkId: { type: String, default: "" },
  },
  { _id: false }
);

const StreetLightPoleSchema = new mongoose.Schema(
  {
    // TK-LED-ปปดด##### เช่น TK-LED-690700001 — เลขต้น 5 หลักวิ่งต่อเนื่อง ไม่รีเซ็ตตามเดือน
    code: { type: String, required: true },
    name: { type: String, default: "" }, // ชื่อ/เลขเดิมจากไฟล์ KMZ (เช่น "Marker 12")
    group: { type: String, required: true }, // ชุมชน/กลุ่ม — ย้ายกลุ่มได้ผ่านฟอร์มแก้ไข
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    lampType: {
      type: String,
      enum: ["led", "other", "unknown"],
      default: "unknown",
    },
    status: {
      type: String,
      enum: ["normal", "damaged", "off", "unknown"],
      default: "unknown",
    },
    photoUrl: { type: String, default: "" }, // รูปล่าสุด (Cloudinary)
    note: { type: String, default: "" },
    lastSurveyedAt: { type: Date, default: null },
    lastSurveyedBy: { type: String, default: "" },
    surveys: { type: [SurveyEntrySchema], default: [] },
    source: {
      type: String,
      enum: ["kmz-import", "manual"],
      default: "manual",
    },
  },
  { collection: "street_light_poles", timestamps: true }
);

StreetLightPoleSchema.index({ code: 1 }, { unique: true });
StreetLightPoleSchema.index({ group: 1 });

export default mongoose.models.StreetLightPole ||
  mongoose.model("StreetLightPole", StreetLightPoleSchema);
