import type { NextApiRequest, NextApiResponse } from "next";
import { resolveWeekSchedule } from "@/lib/garbage/resolve";
import { resolveDateParam } from "@/lib/garbage/time";

/**
 * ตารางทั้งสัปดาห์ที่ครอบวันที่ระบุ เรียงอาทิตย์→เสาร์ (days.length === 7 เสมอ)
 * เปิดสาธารณะเหมือน /api/garbage/schedule — เป็นข้อมูลชุดเดียวกัน ไม่มีข้อมูลใหม่รั่ว
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const date = resolveDateParam(req.query.date);
  if (date == null) {
    return res.status(400).json({ error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" });
  }

  try {
    const days = await resolveWeekSchedule(date);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ startDate: days[0].date, endDate: days[6].date, days });
  } catch (err) {
    console.error("[garbage/week]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
