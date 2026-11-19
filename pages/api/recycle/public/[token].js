// GET /api/recycle/public/:token — หน้าสมาชิกดูยอดและประวัติของตัวเอง (สแกน QR บนบัตร)
//
// ⚠️ จงใจไม่มี auth (ตามที่ตกลงกับผู้ใช้งาน: สมาชิกสแกนแล้วดูได้เลย ไม่ต้องยืนยันตัวตน)
// ป้องกันการไล่เดาด้วย publicToken แบบสุ่ม 12 ตัว (ไม่ใช่รหัส PS-xxxx ที่เรียงเลข)
// และส่งเฉพาะข้อมูลที่จำเป็น — ห้ามเพิ่มเบอร์โทร/ที่อยู่/หมายเหตุ/ชื่อเจ้าหน้าที่ลงใน response นี้
import dbConnect from "@/lib/dbConnect";
import RecycleMember from "@/models/recycle/RecycleMember";
import RecycleDeposit from "@/models/recycle/RecycleDeposit";
import RecycleRedemption from "@/models/recycle/RecycleRedemption";
import RecycleReward from "@/models/recycle/RecycleReward";
import { isPublicToken } from "@/lib/recycle/publicToken";
import { getBalanceKg } from "@/lib/recycle/balance";
import { roundKg } from "@/lib/recycle/validate";
import { WASTE_GROUPS, WASTE_TYPES } from "@/lib/recycle/wasteTypes";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const { token } = req.query;
  if (!isPublicToken(token)) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลสมาชิก" });

  await dbConnect();
  const member = await RecycleMember.findOne({ publicToken: token }).lean();
  if (!member) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลสมาชิก" });

  const [deposits, redemptions, rewards, byTypeRaw] = await Promise.all([
    RecycleDeposit.find({ memberId: member._id, voided: false })
      .sort({ createdAt: -1 })
      .limit(30)
      .select("depositDate items totalKg createdAt")
      .lean(),
    RecycleRedemption.find({ memberId: member._id, voided: false })
      .sort({ createdAt: -1 })
      .limit(30)
      .select("redeemDate items.name items.qty items.unit items.subtotalKg totalKg createdAt")
      .lean(),
    member.isActive
      ? RecycleReward.find({ isActive: true }).sort({ sortOrder: 1, kgCost: 1 }).select("name kgCost unit stock").lean()
      : [],
    // น้ำหนักสะสมตามประเภท (ตลอดอายุสมาชิก) ใช้ทำแถบ "คุณช่วยแยกขยะไปแล้ว"
    RecycleDeposit.aggregate([
      { $match: { memberId: member._id, voided: false } },
      { $unwind: "$items" },
      { $group: { _id: "$items.type", kg: { $sum: "$items.kg" } } },
    ]),
  ]);
  const groupOf = Object.fromEntries(WASTE_TYPES.map((t) => [t.id, t.group]));
  const groupKg = {};
  for (const r of byTypeRaw) {
    const g = groupOf[r._id] || "other";
    groupKg[g] = (groupKg[g] || 0) + r.kg;
  }
  const byGroup = WASTE_GROUPS.map((g) => ({ group: g.id, label: g.label, kg: roundKg(groupKg[g.id] || 0) })).filter((g) => g.kg > 0);

  res.setHeader("Cache-Control", "no-store");
  return res.json({
    success: true,
    member: {
      fullName: member.fullName,
      code: member.code,
      isActive: member.isActive,
      totalKg: member.totalKg || 0,
      redeemedKg: member.redeemedKg || 0,
      balanceKg: getBalanceKg(member),
      depositCount: member.depositCount || 0,
    },
    deposits: deposits.map((d) => ({ id: d._id, date: d.depositDate, at: d.createdAt, items: d.items, totalKg: d.totalKg })),
    redemptions: redemptions.map((r) => ({ id: r._id, date: r.redeemDate, at: r.createdAt, items: r.items, totalKg: r.totalKg })),
    byGroup,
    rewards: rewards.map((r) => ({ id: r._id, name: r.name, kgCost: r.kgCost, unit: r.unit, stock: r.stock })),
  });
}
