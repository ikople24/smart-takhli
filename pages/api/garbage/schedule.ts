import type { NextApiRequest, NextApiResponse } from "next";
import { resolveScheduleForDate } from "@/lib/garbage/resolve";
import { todayInBangkok } from "@/lib/garbage/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/u;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const raw = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;
  const date = raw ?? todayInBangkok();

  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00+07:00`))) {
    return res.status(400).json({ error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" });
  }

  try {
    const schedule = await resolveScheduleForDate(date);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(schedule);
  } catch (err) {
    console.error("[garbage/schedule]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
