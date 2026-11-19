import mongoose from "mongoose";

// การฝากขยะรีไซเคิล 1 ครั้ง (1 สมาชิก หลายประเภท) — น้ำหนักเป็น กก.
const DepositItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // id จาก lib/recycle/wasteTypes.js
    kg: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const RecycleDepositSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "RecycleMember", required: true, index: true },
    // snapshot ไว้แสดงผล/รายงาน แม้สมาชิกเปลี่ยนชื่อภายหลัง
    memberCode: { type: String, required: true, index: true },
    memberName: { type: String, required: true },
    community: { type: String, default: "" },

    depositDate: { type: String, required: true, index: true }, // YYYY-MM-DD (Asia/Bangkok)
    items: { type: [DepositItemSchema], default: [] },
    totalKg: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },

    recordedBy: {
      clerkId: { type: String, default: "" },
      name: { type: String, default: "" },
    },

    // ยกเลิกแทนการลบ — เก็บร่องรอยไว้
    voided: { type: Boolean, default: false, index: true },
    voidReason: { type: String, default: "" },
    voidedBy: {
      clerkId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    voidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RecycleDepositSchema.index({ depositDate: 1, voided: 1 });

export default mongoose.models.RecycleDeposit ||
  mongoose.model("RecycleDeposit", RecycleDepositSchema, "recycle_deposits");
