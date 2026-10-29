// GET /api/smart-papar/field/queue — คิวโบตะกอนของทีมที่เครื่องนี้สังกัด (cookie จากการใส่รหัส)
// ทีมหาจากชื่อที่ใส่ตอนปลดล็อก (แอดมินจับคู่ชื่อ → ทีมที่แท็บรายงาน) · ชื่อไม่อยู่ทีมไหน = { team: null }
// คืนเฉพาะเลยกำหนด / วันนี้ / 7 วันข้างหน้า และเฉพาะข้อมูลที่ต้องใช้เลือกหัวในฟอร์ม (ไม่มีชื่อคนอื่น)
import dbConnect from "@/lib/dbConnect";
import { readFieldSession } from "@/lib/smart-papar/fieldAuth";
import { teamResolver } from "@/lib/smart-papar/flushingSchedule";
import { loadQueue } from "@/lib/smart-papar/loadFlushingData";

const FIELD_BUCKETS = new Set(["overdue", "today", "upcoming"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const session = readFieldSession(req);
  if (!session) {
    return res
      .status(401)
      .json({ success: false, message: "เครื่องนี้ยังไม่ได้ใส่รหัสเจ้าหน้าที่ หรือรหัสถูกเปลี่ยนแล้ว" });
  }

  try {
    await dbConnect();
    const { teams, items } = await loadQueue();
    res.setHeader("Cache-Control", "no-store");
    const teamKey = teamResolver(teams)(session.name);
    const team = teams.find((t) => t.key === teamKey);
    if (!team) return res.status(200).json({ success: true, team: null, items: [] });
    return res.status(200).json({
      success: true,
      team: { key: team.key, label: team.label },
      items: items
        .filter((i) => i.teamKey === teamKey && FIELD_BUCKETS.has(i.bucket))
        .map((i) => ({
          pointId: i.point._id,
          code: i.point.code,
          name: i.point.name,
          roadName: i.point.roadName,
          dueYmd: i.dueYmd,
          daysLeft: i.daysLeft,
          bucket: i.bucket,
          lastResult: i.lastLog?.result || null,
        })),
    });
  } catch (error) {
    console.error("smart-papar field queue error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
