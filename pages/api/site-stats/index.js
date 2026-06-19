import dbConnect from "@/lib/dbConnect";
import SiteVisitDaily from "@/models/site-stats/SiteVisitDaily";
import SiteStatsTotal from "@/models/site-stats/SiteStatsTotal";
import SiteOnline from "@/models/site-stats/SiteOnline";
import { getBangkokYMD } from "@/lib/site-stats/date";

// สถิติการเข้าชมเว็บไซต์ (public): total, today, month, online
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const ymd = getBangkokYMD();
    const monthPrefix = ymd.slice(0, 7);

    const [totalDoc, todayDoc, monthAgg, online] = await Promise.all([
      SiteStatsTotal.findById("total").lean(),
      SiteVisitDaily.findOne({ date: ymd }).lean(),
      SiteVisitDaily.aggregate([
        { $match: { date: { $regex: `^${monthPrefix}` } } },
        { $group: { _id: null, sum: { $sum: "$count" } } },
      ]),
      SiteOnline.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total: totalDoc?.count || 0,
        today: todayDoc?.count || 0,
        month: monthAgg?.[0]?.sum || 0,
        online,
      },
    });
  } catch (error) {
    console.error("Error fetching site stats:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
