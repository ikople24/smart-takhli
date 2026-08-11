import mongoose from "mongoose";
import { WASTE_GROUP_KEYS } from "@/lib/smart-waste/wasteGroups";

// master data ประเภทขยะ — แอดมินเพิ่ม/แก้/ปิดได้เองผ่านหน้าจัดการประเภท
// seed ครั้งแรก 24 รายการจาก lib/smart-waste/wasteTypesSeed.js
const WasteTypeSchema = new mongoose.Schema(
  {
    // slug ไม่ซ้ำ เช่น 'plastic_pet' — ล็อกถาวรหลังบันทึก เพราะ WasteDaily.entries อ้างถึง
    key: { type: String, required: true },
    label: { type: String, required: true },
    // 1 ใน 8 กลุ่มของ lib/smart-waste/wasteGroups.js — กลุ่มเป็น fixed ในโค้ด
    group: { type: String, required: true, enum: WASTE_GROUP_KEYS },
    // ลำดับคอลัมน์ในไฟล์ Excel เดิม — คุม layout ตอน export
    order: { type: Number, required: true },
    // เด้งขึ้นหน้าแรกของฟอร์มมือถือ
    isCommon: { type: Boolean, default: false },
    // สนใจเป็นพิเศษ → StatCard ของตัวเอง + แถว "เฉพาะ<label>" ในชีต "รวม"
    isHighlighted: { type: Boolean, default: false },
    // ปิดใช้งานแทนการลบ — ข้อมูลย้อนหลังที่อ้างถึงประเภทนี้ยังอยู่ครบ
    active: { type: Boolean, default: true },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_waste_types", timestamps: true }
);

WasteTypeSchema.index({ key: 1 }, { unique: true });
WasteTypeSchema.index({ active: 1, order: 1 });

export default mongoose.models.WasteType ||
  mongoose.model("WasteType", WasteTypeSchema, "smart_waste_types");
