// /api/smart-papar/flushing/teams — ทีมงานโบตะกอน (แอดมิน)
// GET : ทีม + ชื่อคนบันทึกทุกชื่อที่พบในระบบ (พร้อมจำนวนบันทึก) ให้จับคู่กับทีม
// PUT : { teams: [{ key, members: [ชื่อ] }] } — ชื่อหนึ่งอยู่ได้ทีมเดียว
import dbConnect from "@/lib/dbConnect";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import FlushingTeam from "@/models/smart-papar/FlushingTeam";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import { validateTeamsInput } from "@/lib/smart-papar/flushingSchedule";
import { loadTeams } from "@/lib/smart-papar/loadFlushingData";

async function names() {
  const rows = await FlushingLog.aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: "$createdByName", count: { $sum: 1 }, lastAt: { $max: "$flushedAt" } } },
    { $sort: { count: -1 } },
  ]);
  return rows.filter((r) => String(r._id || "").trim()).map((r) => ({ name: r._id.trim(), count: r.count, lastAt: r.lastAt }));
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

  try {
    await dbConnect();
    if (req.method === "PUT") {
      const v = validateTeamsInput(req.body);
      if (!v.ok) return res.status(400).json({ success: false, message: v.message });
      await loadTeams(); // ให้มีเอกสารทีมก่อนอัปเดต
      await FlushingTeam.bulkWrite(
        v.value.map((t) => ({
          updateOne: {
            filter: { key: t.key },
            update: { $set: { members: t.members, updatedByClerkId: auth.userId, updatedByName: auth.name || "" } },
          },
        }))
      );
    }
    const [teams, people] = await Promise.all([loadTeams(), names()]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true, teams, names: people });
  } catch (error) {
    console.error("smart-papar flushing teams error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
