import dbConnect from "@/lib/dbConnect";
import SiteOnline from "@/models/site-stats/SiteOnline";

// heartbeat ผู้ใช้ออนไลน์ (public) — upsert lastSeen; TTL 5 นาทีลบ doc ที่เงียบ
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const { clientId } = req.body || {};
    if (!clientId || typeof clientId !== "string") {
      return res.status(400).json({ success: false, message: "clientId required" });
    }
    await dbConnect();
    await SiteOnline.updateOne(
      { clientId },
      { $set: { lastSeen: new Date() } },
      { upsert: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error site ping:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
