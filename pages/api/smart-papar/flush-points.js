// GET /api/smart-papar/flush-points — ทะเบียนหัวโบล์ + วันที่โบล่าสุดของแต่ละหัว
// ใช้ได้ 2 ทาง: เครื่องภาคสนามที่ใส่รหัสแล้ว (cookie) หรือแอดมินที่มีสิทธิ์หน้าคุณภาพน้ำ
// ไม่เปิดสาธารณะ — เป็นตำแหน่งอุปกรณ์ประปา
import dbConnect from "@/lib/dbConnect";
import FlushPoint from "@/models/smart-papar/FlushPoint";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { readFieldSession } from "@/lib/smart-papar/fieldAuth";
import { requireSmartPaparAdmin } from "./water-quality/_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (!readFieldSession(req)) {
    const auth = await requireSmartPaparAdmin(req).catch(() => null);
    if (!auth) return res.status(500).json({ success: false, message: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
    if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
  }

  try {
    await dbConnect();
    const [points, last] = await Promise.all([
      FlushPoint.find({ active: true })
        .select({
          code: 1,
          kind: 1,
          roadName: 1,
          name: 1,
          location: 1,
          photoUrl: 1,
          "legacy.surveyedAt": 1,
          "legacy.surveyedBy": 1,
        })
        .sort({ code: 1 })
        .lean(),
      FlushingLog.aggregate([
        { $match: { deletedAt: null, flushPointId: { $type: "objectId" } } },
        { $group: { _id: "$flushPointId", lastFlushedAt: { $max: "$flushedAt" }, count: { $sum: 1 } } },
      ]),
    ]);
    const byId = new Map(last.map((l) => [String(l._id), l]));
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json({
      success: true,
      data: points.map((p) => {
        const l = byId.get(String(p._id));
        return { ...p, lastFlushedAt: l?.lastFlushedAt || null, flushCount: l?.count || 0 };
      }),
    });
  } catch (error) {
    console.error("smart-papar flush-points GET error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
