// DELETE /api/recycle/redemptions/:id  { reason }
// ยกเลิกการแลก (void) → คืนยอดน้ำหนักให้สมาชิก + คืนสต็อกของรางวัลที่จำกัดจำนวน
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleReward from "@/models/recycle/RecycleReward";
import RecycleRedemption from "@/models/recycle/RecycleRedemption";
import { withRecycleAuth } from "../_auth";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสรายการไม่ถูกต้อง" });
  }

  if (req.method === "GET") {
    const redemption = await RecycleRedemption.findById(id).lean();
    if (!redemption) return res.status(404).json({ success: false, message: "ไม่พบรายการ" });
    return res.json({ success: true, redemption });
  }

  if (req.method === "DELETE") {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "กรุณาระบุเหตุผลที่ยกเลิก" });

    // เปลี่ยนสถานะแบบมีเงื่อนไข voided:false กันยกเลิกซ้ำแล้วคืนยอดสองรอบ
    const redemption = await RecycleRedemption.findOneAndUpdate(
      { _id: id, voided: false },
      {
        $set: {
          voided: true,
          voidReason: reason.slice(0, 300),
          voidedBy: { clerkId: auth.userId, name: auth.name },
          voidedAt: new Date(),
        },
      },
      { new: true }
    ).lean();
    if (!redemption) return res.status(400).json({ success: false, message: "ไม่พบรายการ หรือถูกยกเลิกไปแล้ว" });

    for (const it of redemption.items) {
      // คืนสต็อกเฉพาะของที่ยังนับจำนวนอยู่ (stock เป็นตัวเลข)
      await RecycleReward.updateOne({ _id: it.rewardId, stock: { $type: "number" } }, { $inc: { stock: it.qty } });
    }
    const member = await RecycleMember.findByIdAndUpdate(
      redemption.memberId,
      { $inc: { redeemedKg: -redemption.totalKg } },
      { new: true }
    ).lean();
    return res.json({ success: true, redemption, member });
  }

  res.setHeader("Allow", "GET, DELETE");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
