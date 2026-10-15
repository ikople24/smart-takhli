// GET /api/smart-papar/water-quality/public-summary — สรุปคุณภาพน้ำสำหรับหน้าประชาชน /papar (ไม่ต้องล็อกอิน)
// ส่งออกเฉพาะตัวเลขรวม: ค่าน้ำประปาจ่ายออก 30 วันล่าสุด + งานโบตะกอนรายวัน (จำนวน/ใสแล้ว)
// ห้ามเพิ่มชื่อเจ้าหน้าที่ ตำแหน่ง รูป หรือหมายเหตุของงานโบ — เป็นหน้าสาธารณะ
import dbConnect from "@/lib/dbConnect";
import WaterQualityDaily from "@/models/smart-papar/WaterQualityDaily";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { WATER_STANDARDS, dailyRow, flushingDaily } from "@/lib/smart-papar/publicSummary";

const DAYS = 30;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
    const since = new Date(Date.now() - DAYS * 86400000);
    const [docs, flushDays] = await Promise.all([
      WaterQualityDaily.find({}).sort({ recordDate: -1 }).limit(DAYS).select({ recordDate: 1, tap: 1 }).lean(),
      FlushingLog.aggregate([
        { $match: { deletedAt: null, flushedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$flushedAt", timezone: "Asia/Bangkok" } },
            total: { $sum: 1 },
            clear: { $sum: { $cond: [{ $eq: ["$result", "clear"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const daily = docs.map(dailyRow);
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).json({
      success: true,
      data: {
        standards: WATER_STANDARDS,
        latest: daily[0] || null,
        daily,
        flushing: flushingDaily(flushDays.map((d) => ({ date: d._id, total: d.total, clear: d.clear }))),
      },
    });
  } catch (error) {
    console.error("smart-papar public-summary error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
