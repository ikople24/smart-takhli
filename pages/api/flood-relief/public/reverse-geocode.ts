import type { NextApiRequest, NextApiResponse } from "next";
import { parseLatLng } from "@/lib/flood-relief/geo";
import { locate } from "@/lib/flood-relief/locate";

/**
 * GET /api/flood-relief/public/reverse-geocode?lat=&lng=  — สาธารณะ (ฟอร์มขอความช่วยเหลือ ไม่ต้องล็อกอิน)
 * คืน { communityName, zoneLevel } ใช้ locate() ตัวเดียวกับตอนสร้างคำขอ
 * ไม่คืน zoneId/ชื่อโซน/geometry — ประชาชนเห็นแค่ระดับ
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  const point = parseLatLng(req.query.lat, req.query.lng);
  if (!point) return res.status(400).json({ error: "พิกัดไม่ถูกต้อง" });

  const { communityName, zone } = await locate(point);
  return res.status(200).json({ communityName, zoneLevel: zone?.level ?? null });
}
