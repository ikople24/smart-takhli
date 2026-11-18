// GET    /api/recycle/deposits/:id
// PUT    /api/recycle/deposits/:id  { items, note }  → แก้น้ำหนัก (ยอดสะสมสมาชิกปรับตามส่วนต่าง)
// DELETE /api/recycle/deposits/:id  { reason }       → ยกเลิกรายการ (void) ไม่ลบจริง
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleDeposit from "@/models/recycle/RecycleDeposit";
import { withRecycleAuth } from "../_auth";
import { normalizeDepositItems, roundKg } from "@/lib/recycle/validate";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  const { id } = req.query;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "รหัสรายการไม่ถูกต้อง" });
  }
  const deposit = await RecycleDeposit.findById(id);
  if (!deposit) return res.status(404).json({ success: false, message: "ไม่พบรายการ" });

  if (req.method === "GET") {
    return res.json({ success: true, deposit });
  }

  if (deposit.voided) {
    return res.status(400).json({ success: false, message: "รายการนี้ถูกยกเลิกแล้ว" });
  }

  if (req.method === "PUT") {
    const { items, totalKg, errors } = normalizeDepositItems(req.body?.items);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });

    const diff = roundKg(totalKg - deposit.totalKg);
    deposit.items = items;
    deposit.totalKg = totalKg;
    if (typeof req.body?.note === "string") deposit.note = req.body.note.trim().slice(0, 500);
    await deposit.save();

    const member = await RecycleMember.findByIdAndUpdate(
      deposit.memberId,
      { $inc: { totalKg: diff } },
      { new: true }
    ).lean();
    return res.json({ success: true, deposit, member });
  }

  if (req.method === "DELETE") {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "กรุณาระบุเหตุผลที่ยกเลิก" });

    deposit.voided = true;
    deposit.voidReason = reason.slice(0, 300);
    deposit.voidedBy = { clerkId: auth.userId, name: auth.name };
    deposit.voidedAt = new Date();
    await deposit.save();

    const member = await RecycleMember.findByIdAndUpdate(
      deposit.memberId,
      { $inc: { totalKg: -deposit.totalKg, depositCount: -1 } },
      { new: true }
    ).lean();
    return res.json({ success: true, deposit, member });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
