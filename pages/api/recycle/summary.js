// GET /api/recycle/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// สรุปน้ำหนักตามประเภท / ตามชุมชน / รายวัน (ไม่รวมรายการที่ยกเลิก)
import dbConnect from "@/lib/dbConnect";
import RecycleDeposit from "@/models/recycle/RecycleDeposit";
import RecycleMember from "@/models/recycle/RecycleMember";
import { withRecycleAuth } from "./_auth";
import { getBangkokYMD, isYMD } from "@/lib/recycle/dates";
import { roundKg } from "@/lib/recycle/validate";
import { WASTE_TYPES } from "@/lib/recycle/wasteTypes";

export default async function handler(req, res) {
  const auth = await withRecycleAuth(req, res);
  if (!auth) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  await dbConnect();

  const today = getBangkokYMD();
  const from = isYMD(req.query.from) ? req.query.from : today.slice(0, 8) + "01";
  const to = isYMD(req.query.to) ? req.query.to : today;
  const match = { voided: false, depositDate: { $gte: from, $lte: to } };

  const [overall] = await RecycleDeposit.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalKg: { $sum: "$totalKg" },
        depositCount: { $sum: 1 },
        members: { $addToSet: "$memberId" },
      },
    },
  ]);

  const byTypeRaw = await RecycleDeposit.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $group: { _id: "$items.type", kg: { $sum: "$items.kg" } } },
  ]);
  const typeMap = new Map(byTypeRaw.map((r) => [r._id, r.kg]));
  const byType = WASTE_TYPES.map((t) => ({ type: t.id, label: t.label, group: t.group, kg: roundKg(typeMap.get(t.id) || 0) }));

  const byCommunity = (
    await RecycleDeposit.aggregate([
      { $match: match },
      { $group: { _id: "$community", kg: { $sum: "$totalKg" }, count: { $sum: 1 } } },
      { $sort: { kg: -1 } },
    ])
  ).map((r) => ({ community: r._id || "ไม่ระบุ", kg: roundKg(r.kg), count: r.count }));

  const byDay = (
    await RecycleDeposit.aggregate([
      { $match: match },
      { $group: { _id: "$depositDate", kg: { $sum: "$totalKg" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
  ).map((r) => ({ date: r._id, kg: roundKg(r.kg), count: r.count }));

  const memberTotal = await RecycleMember.countDocuments({ isActive: true });

  return res.json({
    success: true,
    from,
    to,
    totalKg: roundKg(overall?.totalKg || 0),
    depositCount: overall?.depositCount || 0,
    activeMemberCount: overall?.members?.length || 0,
    memberTotal,
    byType,
    byCommunity,
    byDay,
  });
}
