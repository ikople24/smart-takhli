import dbConnect from "@/lib/dbConnect";
import SiteVisitDaily from "@/models/site-stats/SiteVisitDaily";
import SiteStatsTotal from "@/models/site-stats/SiteStatsTotal";
import { getBangkokYMD } from "@/lib/site-stats/date";

// นับการเข้าชมเว็บไซต์ (public, fire-and-forget — กันซ้ำ 1/วัน ฝั่ง client)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const date = getBangkokYMD();
    await Promise.all([
      SiteVisitDaily.updateOne({ date }, { $inc: { count: 1 } }, { upsert: true }),
      SiteStatsTotal.updateOne({ _id: "total" }, { $inc: { count: 1 } }, { upsert: true }),
    ]);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error counting site visit:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
