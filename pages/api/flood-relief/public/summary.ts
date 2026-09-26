import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodZone from "@/models/flood-relief/FloodZone";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { situationLevel } from "@/lib/flood-relief/zones";

/**
 * GET /api/flood-relief/public/summary — สาธารณะ (บล็อกหน้าแรก)
 * { centerOpen, level, updatedAt, hotline, callbackSlaMin, announcement }
 * level = ระดับโซนสูงสุดที่ยังเปิดใช้งาน (ไม่มีโซน = normal) · updatedAt = เวลาแก้โซน/ค่าตั้งล่าสุด
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

    // หน้าแรกคนเข้าเยอะ — cache สั้น ๆ ที่ CDN พอ (ระดับโซนไม่ได้เปลี่ยนทุกวินาที)
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      centerOpen: settings.centerOpen,
      level: situationLevel(zones),
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
