import mongoose from "mongoose";
// FAMILY_STATUS_OPTIONS อยู่ใน lib (ไม่ใช่ที่นี่) เพราะไฟล์นี้ import mongoose — client component ห้าม import ไฟล์นี้ตรง ๆ
// (ดูคอมเมนต์ใน lib/smart-school/familyStatusOptions.js) re-export ไว้ที่นี่ให้โค้ดฝั่งเซิร์ฟเวอร์ (เช่น submit.js) ใช้ทางเดียวกับ enum
import { FAMILY_STATUS_OPTIONS } from "@/lib/smart-school/familyStatusOptions";

export const APPLICATION_STATUSES = [
  "รับคำร้อง",
  "ตรวจสอบแล้ว",
  "ได้รับทุน",
  "ไม่ผ่านเกณฑ์",
];

export { FAMILY_STATUS_OPTIONS };

// ใบสมัคร/แบบสำรวจ 1 ใบต่อคนต่อปีงบประมาณ
const SchoolApplicationSchema = new mongoose.Schema(
  {
    applicantRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolApplicant",
      required: true,
      index: true,
    },
    surveyYear: { type: Number, required: true, index: true }, // ปีงบประมาณ พ.ศ. เช่น 2569
    applicationId: { type: String, required: true, unique: true }, // TKC69-001

    educationLevel: { type: String, default: "" },
    schoolName: { type: String, default: "" },
    gradeLevel: { type: String, default: "" },
    gpa: { type: Number, min: 0, max: 4, default: null },
    address: { type: String, default: "" },
    actualAddress: { type: String, default: "" },
    housingStatus: {
      type: String,
      enum: ["ผู้อาศัย", "เจ้าของ", "บ้านเช่า", "อื่นๆ", "ไม่ระบุ", ""],
      default: "ไม่ระบุ",
    },
    householdMembers: { type: Number, default: 1, min: 1 },
    annualIncome: { type: Number, default: 0 },
    incomeSource: { type: [String], default: [] },
    familyStatus: {
      type: [String],
      enum: FAMILY_STATUS_OPTIONS,
      default: [],
    },
    receivedScholarship: { type: [String], default: [] },
    // ประวัติทุนเทศบาลแบบ self-report จากฟอร์ม (ไม่ใส่ enum — ปีใหม่เพิ่มได้เรื่อย ๆ)
    // ผลพิจารณาจริงของระบบใช้ status "ได้รับทุน" รายปีแทน
    takhliScholarshipHistory: { type: [String], default: [] },
    note: { type: String, default: "" },
    imageUrl: {
      type: [String],
      default: [],
      validate: [(a) => Array.isArray(a) && a.length <= 3, "Maximum of 3 images allowed"],
    },
    location: { lat: Number, lng: Number },

    // --- เกณฑ์พิจารณาทุน (เฟส scholarship) ---
    residencyOverOneYear: { type: Boolean, default: null }, // มีชื่อในทะเบียนบ้านในเขต ≥1 ปี (จากฟอร์ม)
    schoolEligibility: { type: String, enum: ["ok", "block"], default: "ok" }, // block ถ้าตรง blocklist
    eligibilityChecklist: {
      residencyVerified: { type: Boolean, default: false },
      schoolVerified: { type: Boolean, default: false },
      documentsVerified: { type: Boolean, default: false },
    },
    householdKey: { type: String, default: null, index: true }, // จัดกลุ่มครัวเรือน
    scholarshipAmount: { type: Number, default: null }, // เงินทุนเมื่อ "ได้รับทุน"
    scholarshipRank: { type: Number, default: null, min: 1 }, // ลำดับที่เจ้าหน้าที่จัดเอง (ต่อระดับ)

    status: { type: String, enum: APPLICATION_STATUSES, default: "รับคำร้อง" },
    statusUpdatedBy: { type: String, default: "" },
    statusUpdatedAt: { type: Date, default: null },
    isRenewal: { type: Boolean, default: false }, // รายเก่า (เคยมีใบปีก่อนหน้า)
  },
  { timestamps: true }
);

// 1 คน 1 ใบต่อปี
SchoolApplicationSchema.index({ applicantRef: 1, surveyYear: 1 }, { unique: true });

export default mongoose.models.SchoolApplication ||
  mongoose.model("SchoolApplication", SchoolApplicationSchema, "school_applications");
