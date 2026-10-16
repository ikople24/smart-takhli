// GET /api/smart-papar/water-reports/locate?lat=&lng= — ชื่อชุมชนจากพิกัด ให้ฟอร์มแจ้งน้ำโชว์ก่อนส่ง (สาธารณะ)
// ใช้ findCommunityName ตัวเดียวกับตอนบันทึก เพื่อให้คำตอบตรงกัน · คืนแค่ชื่อชุมชน
import { findCommunityName } from "@/lib/flood-relief/locate";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, message: "พิกัดไม่ถูกต้อง" });
  }
  const communityName = await findCommunityName({ lat, lng }).catch(() => null);
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).json({ success: true, data: { communityName } });
}
