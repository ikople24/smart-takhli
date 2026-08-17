import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId } = req.query;

  if (!complaintId) {
    return res.status(400).json({ success: false, message: "Missing complaintId" });
  }

  try {
    // เอนด์พอยต์นี้ไม่มี auth — select เฉพาะฟิลด์ที่ปลอดภัยต่อการเปิดสาธารณะ
    // (ห้ามคืนทั้ง document เพราะแถว source: 'line' มี lineUserId ของประชาชนติดไปด้วย)
    const satisfaction = await Satisfaction.findOne({ complaintId })
      .select("rating comment createdAt")
      .lean();
    
    if (!satisfaction) {
      return res.status(200).json({ success: true, data: null });
    }

    return res.status(200).json({ success: true, data: satisfaction });
  } catch (error) {
    console.error("Error fetching satisfaction:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

