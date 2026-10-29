// GET /api/smart-papar/flushing/queue — คิวงานโบตะกอนประจำของทุกหัว (แอดมิน)
// รอบ: ใสแล้ว +15 วัน · ยังขุ่น +5 วัน นับจากวันโบล่าสุด · จ่ายให้ทีมของคนที่โบครั้งล่าสุด
import dbConnect from "@/lib/dbConnect";
import { requireSmartPaparAdmin } from "../water-quality/_auth";
import { queueCounts } from "@/lib/smart-papar/flushingSchedule";
import { loadQueue } from "@/lib/smart-papar/loadFlushingData";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const auth = await requireSmartPaparAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });

  try {
    await dbConnect();
    const { teams, items } = await loadQueue();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      teams: teams.map(({ key, label }) => ({ key, label })),
      counts: queueCounts(items),
      items: items.map(({ point, lastLog, ...rest }) => ({
        ...rest,
        pointId: point._id,
        code: point.code,
        name: point.name,
        roadName: point.roadName,
        kind: point.kind,
        coordinates: point.location?.coordinates || null,
        lastFlushedAt: lastLog?.flushedAt || null,
        lastResult: lastLog?.result || null,
        lastTurbidCause: lastLog?.turbidCause || "",
        lastByName: lastLog?.createdByName || "",
        lastNtuBefore: lastLog?.turbidityBeforeNtu ?? null,
        lastNtuAfter: lastLog?.turbidityAfterNtu ?? null,
        lastPhotos: [...(lastLog?.photosBefore || []), ...(lastLog?.photosAfter || [])],
        lastNote: lastLog?.note || "",
      })),
    });
  } catch (error) {
    console.error("smart-papar flushing queue error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
