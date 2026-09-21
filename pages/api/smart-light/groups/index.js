import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";

// GET /api/smart-light/groups — รายชื่อกลุ่ม + จำนวนแยกสถานะ + centroid
// centroid ใช้วาด bubble รายกลุ่มบนแผนที่ตอนซูมไกล
export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  try {
    const rows = await StreetLightPole.aggregate([
      {
        $group: {
          _id: "$group",
          total: { $sum: 1 },
          normal: { $sum: { $cond: [{ $eq: ["$status", "normal"] }, 1, 0] } },
          damaged: { $sum: { $cond: [{ $eq: ["$status", "damaged"] }, 1, 0] } },
          off: { $sum: { $cond: [{ $eq: ["$status", "off"] }, 1, 0] } },
          unknown: { $sum: { $cond: [{ $eq: ["$status", "unknown"] }, 1, 0] } },
          lat: { $avg: "$lat" },
          lng: { $avg: "$lng" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const data = rows.map((r) => ({
      group: r._id,
      total: r.total,
      byStatus: { normal: r.normal, damaged: r.damaged, off: r.off, unknown: r.unknown },
      centroid: { lat: r.lat, lng: r.lng },
    }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("smart-light groups GET error:", error);
    return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  }
}
