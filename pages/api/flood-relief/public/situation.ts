import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import FloodRequest from "@/models/flood-relief/FloodRequest";
import FloodZone from "@/models/flood-relief/FloodZone";
import { publicGauge } from "@/lib/flood-relief/gauge";
import { loadFloodSettings } from "@/lib/flood-relief/loadSettings";
import { computePublicStats } from "@/lib/flood-relief/publicStats";
import { effectiveSituation } from "@/lib/flood-relief/settings";
import { situationLevel } from "@/lib/flood-relief/zones";

/**
 * GET /api/flood-relief/public/situation — สาธารณะ (หน้าติดตามสถานการณ์ /flood ให้หน่วยงานอื่น/ผู้สนใจ)
 * คืนระดับสถานการณ์ + โซนสีที่เปิดใช้งาน + ตัวเลขรวม + จุดวัดระดับน้ำ (รูปล่าสุด ไม่มีชื่อผู้อัปโหลด)
 * **ห้ามเพิ่มรายคำขอ/พิกัด/ชื่อ/เบอร์/จุดสังเกต** — query คำขอดึงแค่ status/type/doneAt
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  try {
    await dbConnect();
    const [settings, zones, requests, gauges] = await Promise.all([
      loadFloodSettings(),
      FloodZone.find({ active: true })
        .select({ _id: 0, name: 1, communityName: 1, level: 1, geometry: 1, updatedAt: 1 })
        .lean() as unknown as Promise<
        Array<{ name: string; communityName?: string | null; level: string; geometry: unknown; updatedAt?: Date }>
      >,
      FloodRequest.find({}).select({ _id: 0, status: 1, type: 1, doneAt: 1 }).lean() as unknown as Promise<
        Array<{ status?: string; type?: string; doneAt?: Date | null }>
      >,
      // เลือกเฉพาะช่องที่ publicGauge ใช้ — ไม่ดึง photos/createdBy/updatedBy ออกมาเลย
      FloodGauge.find({ active: true })
        .select({ _id: 0, name: 1, location: 1, note: 1, lastPhotoUrl: 1, lastPhotoAt: 1, lastLevelCm: 1, lastNote: 1 })
        .sort({ name: 1 })
        .lean() as unknown as Promise<Array<Parameters<typeof publicGauge>[0]>>,
    ]);
    const times = [settings.updatedAt, ...zones.map((z) => z.updatedAt)]
      .map((t) => (t ? new Date(t).getTime() : 0))
      .filter((t) => t > 0);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      centerOpen: settings.centerOpen,
      level: effectiveSituation(settings.situationOverride, situationLevel(zones)),
      updatedAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
      hotline: settings.hotline,
      announcement: settings.announcement,
      zones: zones.map((z) => ({ name: z.communityName || z.name, level: z.level, geometry: z.geometry })),
      stats: computePublicStats(requests),
      gauges: gauges.map((g) => publicGauge(g)),
    });
  } catch (err) {
    console.error("[flood-relief/public/situation] GET", err);
    return res.status(500).json({ error: "โหลดข้อมูลสถานการณ์ไม่สำเร็จ" });
  }
}
