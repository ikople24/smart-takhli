import mongoose from "mongoose";

// การตัดยอดน้ำหนักเพื่อแลกของ 1 ครั้ง
const RedemptionItemSchema = new mongoose.Schema(
  {
    rewardId: { type: mongoose.Schema.Types.ObjectId, ref: "RecycleReward", required: true },
    name: { type: String, required: true }, // snapshot ชื่อ/ราคา ณ วันที่แลก
    unit: { type: String, default: "ชิ้น" },
    kgCost: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    subtotalKg: { type: Number, required: true },
  },
  { _id: false }
);

const RecycleRedemptionSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "RecycleMember", required: true, index: true },
    memberCode: { type: String, required: true, index: true },
    memberName: { type: String, required: true },
    community: { type: String, default: "" },

    redeemDate: { type: String, required: true, index: true }, // YYYY-MM-DD (Asia/Bangkok)
    items: { type: [RedemptionItemSchema], default: [] },
    totalKg: { type: Number, required: true, min: 0 },
    balanceAfterKg: { type: Number, default: null }, // ยอดคงเหลือหลังตัด (ไว้อ้างอิง)
    note: { type: String, default: "" },

    recordedBy: {
      clerkId: { type: String, default: "" },
      name: { type: String, default: "" },
    },

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

RecycleRedemptionSchema.index({ redeemDate: 1, voided: 1 });

export default mongoose.models.RecycleRedemption ||
  mongoose.model("RecycleRedemption", RecycleRedemptionSchema, "recycle_redemptions");
