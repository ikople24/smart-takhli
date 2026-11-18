import mongoose from "mongoose";

// สมาชิกโครงการพระสังข์หอบทอง (ผู้นำขยะรีไซเคิลมาฝาก)
const RecycleMemberSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true }, // PS-0001 — พิมพ์ลงบัตร QR
    fullName: { type: String, required: true, trim: true, index: true },
    phone: { type: String, default: "" },
    community: { type: String, default: "", index: true }, // ชุมชน (lib/takhliCommunities.js)
    groupName: { type: String, default: "" }, // กลุ่ม/จุดรับ (ถ้ามี)
    address: { type: String, default: "" },
    note: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },

    // ยอดสะสม (อัปเดตทุกครั้งที่บันทึก/ยกเลิกการฝาก)
    // ยอดคงเหลือที่แลกได้ = totalKg - redeemedKg  (ดู lib/recycle/balance.js)
    totalKg: { type: Number, default: 0 }, // น้ำหนักที่ฝากทั้งหมด (ตลอดอายุสมาชิก)
    redeemedKg: { type: Number, default: 0 }, // น้ำหนักที่ตัดยอดไปแลกของแล้ว
    depositCount: { type: Number, default: 0 },
    lastDepositAt: { type: Date, default: null },

    createdBy: {
      clerkId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.RecycleMember ||
  mongoose.model("RecycleMember", RecycleMemberSchema, "recycle_members");
