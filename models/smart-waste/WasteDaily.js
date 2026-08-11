import mongoose from "mongoose";
import { WASTE_GROUP_KEYS } from "@/lib/smart-waste/wasteGroups";

// สร้าง sub-schema ของ groupTotals จากรายชื่อกลุ่ม เพื่อไม่ให้ field หลุดจากกัน
// เมื่อรายชื่อกลุ่มเปลี่ยน (จะได้ไม่ต้องไล่แก้ 8 บรรทัดด้วยมือ)
const groupTotalsFields = {};
for (const key of WASTE_GROUP_KEYS) {
  groupTotalsFields[key] = { type: Number, default: 0 };
}

const WasteEntrySchema = new mongoose.Schema(
  {
    typeKey: { type: String, required: true },
    // snapshot กลุ่ม ณ ตอนบันทึก — ถ้าแอดมินย้ายประเภทข้ามกลุ่มภายหลัง
    // รายงานย้อนหลังที่เคยส่งออกไปแล้วต้องไม่เปลี่ยนตัวเลข
    group: { type: String, required: true, enum: WASTE_GROUP_KEYS },
    kg: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

// 1 เอกสาร = 1 วัน รวมทั้งเทศบาล (ไม่แยกจุด/ชุมชน — ตามที่ผู้ใช้เลือก)
const WasteDailySchema = new mongoose.Schema(
  {
    // 'YYYY-MM-DD' ตามวันในไทย — เป็น string เพื่อเลี่ยง timezone shift ทั้งหมด
    recordDate: { type: String, required: true },
    // ปีงบประมาณ พ.ศ. — คำนวณจาก recordDate ด้วย fiscalYearOf() เสมอ ห้ามรับจาก client
    fiscalYear: { type: Number, required: true },

    // เก็บเฉพาะประเภทที่กรอกจริง (5–10 จาก 24) — ไม่เก็บช่องว่าง/0
    entries: { type: [WasteEntrySchema], default: [] },

    // denormalized จาก entries ด้วย computeTotals() ตอนบันทึก
    // เพื่อให้ dashboard/export ไม่ต้อง aggregate ใหม่ทุกครั้ง
    groupTotals: { type: groupTotalsFields, default: () => ({}) },
    totalKg: { type: Number, default: 0 },

    note: { type: String, default: "" },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_waste_daily", timestamps: true }
);

// 1 วัน = 1 เอกสาร — กรอกวันเดิมซ้ำคือ "แก้ของเดิม" ไม่ใช่สร้างใหม่
WasteDailySchema.index({ recordDate: 1 }, { unique: true });
WasteDailySchema.index({ fiscalYear: 1, recordDate: 1 });

export default mongoose.models.WasteDaily ||
  mongoose.model("WasteDaily", WasteDailySchema, "smart_waste_daily");
