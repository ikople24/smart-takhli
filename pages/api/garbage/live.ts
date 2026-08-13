import type { NextApiRequest, NextApiResponse } from "next";
import { resolveScheduleForDate } from "@/lib/garbage/resolve";
import { getLivePosition } from "@/lib/garbage/live";
import { resolveDateParam, minutesNowInBangkok } from "@/lib/garbage/time";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  // ?at=<นาที> ใช้สำหรับทดสอบเท่านั้น ไม่ระบุ = เวลาปัจจุบันของไทย
  const rawAt = Array.isArray(req.query.at) ? req.query.at[0] : req.query.at;
  let nowMin = minutesNowInBangkok();
  if (rawAt != null) {
    const n = Number(rawAt);
    if (!Number.isInteger(n) || n < 0 || n > 1439) {
      return res.status(400).json({ error: "at ต้องเป็นจำนวนเต็ม 0–1439" });
    }
    nowMin = n;
  }

  const date = resolveDateParam(req.query.date);
  if (date == null) {
    return res.status(400).json({ error: "รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD" });
  }

  try {
    const schedule = await resolveScheduleForDate(date);
    const trucks = schedule.assignments.map((a) => ({
      truckNumber: a.truckNumber,
      truckColor: a.truckColor,
      shiftNo: a.shiftNo,
      kind: a.kind,
      routeCode: a.routeCode,
      label: a.label,
      live: getLivePosition(a, nowMin),
    }));

    // สถานะสดต้องไม่ถูกแคชนาน
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ date, nowMin, trucks });
  } catch (err) {
    console.error("[garbage/live]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
