import mongoose from "mongoose";

// ของรางวัลที่จัดไว้ให้สมาชิกนำน้ำหนักสะสมมาแลก
const RecycleRewardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    kgCost: { type: Number, required: true, min: 0.01 }, // ใช้น้ำหนักกี่ กก. ต่อ 1 ชิ้น
    unit: { type: String, default: "ชิ้น" },
    stock: { type: Number, default: null, min: 0 }, // null = ไม่จำกัดจำนวน
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.RecycleReward ||
  mongoose.model("RecycleReward", RecycleRewardSchema, "recycle_rewards");
