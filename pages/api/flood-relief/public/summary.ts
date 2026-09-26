import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodZone from "@/models/flood-relief/FloodZone";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { effectiveSituation } from "@/lib/flood-relief/settings";
import { situationLevel } from "@/lib/flood-relief/zones";

/**
 * GET /api/flood-relief/public/summary — สาธารณะ (บล็อกหน้าแรก)
 * { centerOpen, level, updatedAt, hotline, callbackSlaMin, announcement }
 * level = ค่าที่ superadmin ประกาศทับ หรือ (auto) ระดับโซนสูงสุดที่ยังเปิดใช้งาน (ไม่มีโซน = normal)
 * updatedAt = เวลาแก้โซน/ค่าตั้งล่าสุด
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  try {
    await dbConnect();
    const [settings, zones] = await Promise.all([
      loadFloodSettings(),
      FloodZone.find({ active: true }).select({ level: 1, updatedAt: 1 }).lean() as unknown as Promise<
        Array<{ level: string; updatedAt?: Date }>
      >,
    ]);
    const times = [settings.updatedAt, ...zones.map((z) => z.updatedAt)]
      .map((t) => (t ? new Date(t).getTime() : 0))
      .filter((t) => t > 0);

    // ไม่ cache — ประกาศระดับ/เปิด-ปิดศูนย์ฯ ต้องเห็นผลทันที (query เบามาก: 1 doc + โซนไม่กี่อัน)
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      centerOpen: settings.centerOpen,
      level: effectiveSituation(settings.situationOverride, situationLevel(zones)),
      updatedAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
      hotline: settings.hotline,
      callbackSlaMin: settings.callbackSlaMin,
      announcement: settings.announcement,
    });
  } catch (err) {
    console.error("[flood-relief/public/summary] GET", err);
    return res.status(500).json({ error: "โหลดข้อมูลไม่สำเร็จ" });
  }
}
