// GET  /api/recycle/deposits?date=YYYY-MM-DD | from=&to=  &memberId=&limit=
// POST /api/recycle/deposits  { memberId, items: [{type, kg}] | {type: kg}, note?, depositDate? }
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleDeposit from "@/models/recycle/RecycleDeposit";
import { withRecycleAuth } from "../_auth";
import { normalizeDepositItems, roundKg } from "@/lib/recycle/validate";
import { getBangkokYMD, isYMD } from "@/lib/recycle/dates";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  if (req.method === "GET") {
    const { date, from, to, memberId } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const filter = { voided: false };
    if (isYMD(date)) filter.depositDate = date;
    else if (isYMD(from) || isYMD(to)) {
      filter.depositDate = {};
      if (isYMD(from)) filter.depositDate.$gte = from;
      if (isYMD(to)) filter.depositDate.$lte = to;
    }
    if (memberId) {
      if (!mongoose.isValidObjectId(memberId)) {
        return res.status(400).json({ success: false, message: "memberId ไม่ถูกต้อง" });
      }
      filter.memberId = memberId;
    }

    const deposits = await RecycleDeposit.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const totalKg = roundKg(deposits.reduce((s, d) => s + (d.totalKg || 0), 0));
    return res.json({ success: true, deposits, totalKg, count: deposits.length });
  }

  if (req.method === "POST") {
    const { memberId, note = "" } = req.body || {};
    if (!mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกสมาชิก" });
    }
    const today = getBangkokYMD();
    const depositDate = isYMD(req.body?.depositDate) ? req.body.depositDate : today;
    if (depositDate > today) {
      return res.status(400).json({ success: false, message: "บันทึกล่วงหน้าไม่ได้" });
    }

    const { items, totalKg, errors } = normalizeDepositItems(req.body?.items);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });

    const member = await RecycleMember.findById(memberId).lean();
    if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
    if (!member.isActive) return res.status(400).json({ success: false, message: "สมาชิกนี้ถูกปิดการใช้งาน" });

    const deposit = await RecycleDeposit.create({
      memberId: member._id,
      memberCode: member.code,
      memberName: member.fullName,
      community: member.community || "",
      depositDate,
      items,
      totalKg,
      note: String(note).trim().slice(0, 500),
      recordedBy: { clerkId: auth.userId, name: auth.name },
    });

    const updatedMember = await RecycleMember.findByIdAndUpdate(
      member._id,
      { $inc: { totalKg, depositCount: 1 }, $set: { lastDepositAt: deposit.createdAt } },
      { new: true }
    ).lean();

    return res.status(201).json({ success: true, deposit, member: updatedMember });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
