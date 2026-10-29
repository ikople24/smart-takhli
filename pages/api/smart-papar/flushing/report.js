// GET /api/smart-papar/flushing/report — สรุปงานโบตะกอนสำหรับผู้บริหาร แยกทีม
//   ?period=day&date=YYYY-MM-DD   → สรุปวันนั้น
//   ?period=month&month=YYYY-MM   → สรุปทั้งเดือน + รายวัน
import dbConnect from "@/lib/dbConnect";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import { bangkokDayRange } from "@/lib/smart-papar/flushing";
import { dailyBreakdown, monthRange, summarizeByTeam } from "@/lib/smart-papar/flushingSchedule";
import { loadTeams } from "@/lib/smart-papar/loadFlushingData";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

  const isMonth = req.query.period === "month";
  const days = isMonth ? monthRange(req.query.month) : { from: req.query.date, to: req.query.date };
  const range = days && bangkokDayRange(days.from, days.to);
  if (!range) return res.status(400).json({ success: false, message: "ช่วงวันที่ไม่ถูกต้อง" });

  try {
    await dbConnect();
    const [teams, logs] = await Promise.all([
      loadTeams(),
      FlushingLog.find({ deletedAt: null, flushedAt: { $gte: range.start, $lt: range.end } })
        .select({ flushedAt: 1, result: 1, turbidCause: 1, flushPointId: 1, locationName: 1, createdByName: 1 })
        .lean(),
    ]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      from: days.from,
      to: days.to,
      teams: teams.map(({ key, label }) => ({ key, label })),
      summary: summarizeByTeam({ logs, teams }),
      daily: isMonth ? dailyBreakdown({ logs, teams, month: req.query.month }) : null,
    });
  } catch (error) {
    console.error("smart-papar flushing report error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
