import { recordPublicRating } from "@/lib/satisfaction/record";
import { publicQuotaFullMessage } from "@/lib/satisfaction/quota";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, rating, comment } = req.body;

  if (!complaintId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const result = await recordPublicRating({ complaintId, rating, comment });

    // ให้คะแนนได้เฉพาะเรื่องที่ปิดงานแล้ว และไม่เกินโควตา — กันคนยิง API ตรง ๆ ข้ามหน้าเว็บ
    if (!result.ok) {
      if (result.reason === "quota_exceeded") {
        return res.status(429).json({ success: false, message: publicQuotaFullMessage() });
      }
      return result.reason === "not_closed"
        ? res.status(409).json({
            success: false,
            message: "ให้คะแนนได้เมื่อเรื่องดำเนินการเสร็จสิ้นแล้ว",
          })
        : res.status(404).json({ success: false, message: "ไม่พบเรื่องร้องเรียนนี้" });
    }

    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error("Error saving satisfaction:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
