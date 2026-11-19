// GET  /api/recycle/redemptions?date= | from=&to=  &memberId=
// POST /api/recycle/redemptions  { memberId, items: [{rewardId, qty}] | {rewardId: qty}, note? }
//
// ตัดยอดแบบ atomic: หักยอดสมาชิกด้วยเงื่อนไข "คงเหลือ >= ที่จะแลก" ในคำสั่งเดียว
// แล้วจึงตัดสต็อกของรางวัล — ถ้าขั้นใดล้มเหลวจะคืนค่าที่หักไปแล้ว (compensate)
// เพราะ Mongo ที่ใช้อาจไม่ใช่ replica set จึงไม่พึ่ง transaction
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleReward from "@/models/recycle/RecycleReward";
import RecycleRedemption from "@/models/recycle/RecycleRedemption";
import { withRecycleAuth } from "../_auth";
import { buildRedemptionItems, getBalanceKg } from "@/lib/recycle/balance";
import { roundKg } from "@/lib/recycle/validate";
import { getBangkokYMD, isYMD } from "@/lib/recycle/dates";

const EPS = 0.001;

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  await dbConnect();

  if (req.method === "GET") {
    const { date, from, to, memberId } = req.query;
    const filter = { voided: false };
    if (isYMD(date)) filter.redeemDate = date;
    else if (isYMD(from) || isYMD(to)) {
      filter.redeemDate = {};
      if (isYMD(from)) filter.redeemDate.$gte = from;
      if (isYMD(to)) filter.redeemDate.$lte = to;
    }
    if (memberId) {
      if (!mongoose.isValidObjectId(memberId)) {
        return res.status(400).json({ success: false, message: "memberId ไม่ถูกต้อง" });
      }
      filter.memberId = memberId;
    }
    const redemptions = await RecycleRedemption.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const totalKg = roundKg(redemptions.reduce((s, r) => s + (r.totalKg || 0), 0));
    return res.json({ success: true, redemptions, totalKg, count: redemptions.length });
  }

  if (req.method === "POST") {
    const { memberId, note = "" } = req.body || {};
    if (!mongoose.isValidObjectId(memberId)) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกสมาชิก" });
    }
    const member = await RecycleMember.findById(memberId).lean();
    if (!member) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
    if (!member.isActive) return res.status(400).json({ success: false, message: "สมาชิกนี้ถูกปิดการใช้งาน" });

    const input = req.body?.items;
    const ids = (Array.isArray(input) ? input.map((i) => i?.rewardId) : Object.keys(input || {})).filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const rewards = await RecycleReward.find({ _id: { $in: ids } }).lean();
    const { items, totalKg, errors } = buildRedemptionItems(input, rewards);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(", ") });

    const balance = getBalanceKg(member);
    if (totalKg > balance + EPS) {
      return res
        .status(400)
        .json({ success: false, message: `ยอดคงเหลือไม่พอ (มี ${balance} กก. ต้องใช้ ${totalKg} กก.)` });
    }

    // 1) หักยอดสมาชิก — เงื่อนไขอยู่ในคำสั่งเดียว กันกดซ้ำ/แลกพร้อมกันจนติดลบ
    const updatedMember = await RecycleMember.findOneAndUpdate(
      {
        _id: member._id,
        isActive: true,
        $expr: { $gte: [{ $subtract: ["$totalKg", { $ifNull: ["$redeemedKg", 0] }] }, totalKg - EPS] },
      },
      { $inc: { redeemedKg: totalKg } },
      { new: true }
    ).lean();
    if (!updatedMember) {
      return res.status(409).json({ success: false, message: "ยอดคงเหลือไม่พอ (อาจมีการแลกจากเครื่องอื่น) กรุณาโหลดใหม่" });
    }

    // 2) ตัดสต็อก (เฉพาะของที่จำกัดจำนวน)
    const stockTaken = [];
    const rollback = async () => {
      for (const s of stockTaken) {
        await RecycleReward.updateOne({ _id: s.rewardId }, { $inc: { stock: s.qty } });
      }
      await RecycleMember.updateOne({ _id: member._id }, { $inc: { redeemedKg: -totalKg } });
    };

    for (const it of items) {
      const reward = rewards.find((r) => String(r._id) === String(it.rewardId));
      if (typeof reward?.stock !== "number") continue;
      const r = await RecycleReward.updateOne({ _id: it.rewardId, stock: { $gte: it.qty } }, { $inc: { stock: -it.qty } });
      if (r.modifiedCount !== 1) {
        await rollback();
        return res.status(409).json({ success: false, message: `${it.name} ของไม่พอแล้ว กรุณาโหลดใหม่` });
      }
      stockTaken.push({ rewardId: it.rewardId, qty: it.qty });
    }

    // 3) บันทึกรายการแลก
    try {
      const redemption = await RecycleRedemption.create({
        memberId: member._id,
        memberCode: member.code,
        memberName: member.fullName,
        community: member.community || "",
        redeemDate: getBangkokYMD(),
        items,
        totalKg,
        balanceAfterKg: getBalanceKg(updatedMember),
        note: String(note).trim().slice(0, 500),
        recordedBy: { clerkId: auth.userId, name: auth.name },
      });
      return res.status(201).json({ success: true, redemption, member: updatedMember });
    } catch (e) {
      await rollback();
      throw e;
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
