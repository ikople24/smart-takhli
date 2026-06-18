import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";
import StudentFeedback from "@/models/StudentFeedback";

// ฟีดข่าวกิจกรรม (public): กิจกรรม active เรียงใหม่→เก่า พร้อมคะแนนเฉลี่ยจาก StudentFeedback
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);

    const activities = await Activity.find({ isActive: true })
      .sort({ startDate: -1 })
      .limit(limit)
      .lean();

    const ids = activities.map((a) => a._id);
    const stats = await StudentFeedback.aggregate([
      { $match: { activityId: { $in: ids }, isApproved: true } },
      {
        $group: {
          _id: "$activityId",
          avgRating: { $avg: "$emotionLevel" },
          count: { $sum: 1 },
        },
      },
    ]);
    const statMap = new Map(stats.map((s) => [String(s._id), s]));

    const data = activities.map((a) => {
      const s = statMap.get(String(a._id));
      return {
        ...a,
        stats: {
          avgRating: s ? Math.round(s.avgRating * 10) / 10 : null,
          count: s ? s.count : 0,
        },
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
