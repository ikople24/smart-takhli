import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, source } = req.query;

  if (!complaintId) {
    return res.status(400).json({ success: false, message: "Missing complaintId" });
  }

  try {
    const query = { complaintId };
    // "public" ต้องนับแบบ "ไม่ใช่ line" ไม่ใช่ source === "public" ตรง ๆ —
    // แถวเก่าที่เขียนก่อน backfill ยังไม่มีฟิลด์ source เลย ถ้านับแบบ equal จะหายไป
    // จากโควตา 4 ครั้ง/เรื่องของหน้าเว็บ (ต้องให้ผลตรงกับ stats.js ที่ถือว่าไม่มี = public)
    if (source === "public") {
      query.source = { $ne: "line" };
    } else if (source === "line") {
      query.source = "line";
    }
    const count = await Satisfaction.countDocuments(query);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Error counting satisfaction:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

