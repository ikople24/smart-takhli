import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";

// นับยอดเข้าชม (public, fire-and-forget จาก client — กันซ้ำด้วย sessionStorage ฝั่ง client)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    await dbConnect();
    const { id } = req.query;
    const activity = await Activity.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: "views" }
    );
    if (!activity) {
      return res.status(404).json({ success: false, message: "Activity not found" });
    }
    return res.status(200).json({ success: true, views: activity.views });
  } catch (error) {
    console.error("Error counting activity view:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
