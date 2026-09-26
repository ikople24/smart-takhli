import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/dbConnect";
import FloodGauge from "@/models/flood-relief/FloodGauge";
import { parseGaugeCreate } from "@/lib/flood-relief/gauge";
import { adminGauge } from "@/lib/flood-relief/gaugeView";
import { toGeoPoint } from "@/lib/flood-relief/geo";
import { requireFloodAdmin } from "../_auth";

/**
 * GET  /api/flood-relief/gauges — จุดวัดระดับน้ำทั้งหมด + ประวัติรูปล่าสุด (admin ที่เข้าแดชบอร์ดได้)
 * POST /api/flood-relief/gauges — ปักจุดใหม่ { name, lat, lng, note?, kind? } (admin ทุกคน — เจ้าหน้าที่ภาคสนามต้องปักได้เอง)
 *   kind: gauge (วัดน้ำ) | water (แจกน้ำดื่ม) | donation (รับบริจาค) — 2 อย่างหลังปักได้ที่นี่ที่เดียว (ประชาชนปักไม่ได้)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    await dbConnect();
    if (req.method === "GET") {
      const docs = (await FloodGauge.find({}).sort({ active: -1, name: 1 }).lean()) as Array<Record<string, unknown>>;
      const now = new Date();
      return res.status(200).json({ gauges: docs.map((d) => adminGauge(d, now)) });
    }
    if (req.method === "POST") {
      const v = parseGaugeCreate(req.body);
      if (!v.ok) return res.status(400).json({ error: v.error });
      const doc = await FloodGauge.create({
        name: v.name,
        kind: v.kind,
        source: "staff",
        location: toGeoPoint(v.point),
        note: v.note,
        createdBy: auth.name,
        updatedBy: auth.name,
      });
      return res.status(201).json({ id: String(doc._id) });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "รองรับเฉพาะ GET/POST" });
  } catch (err) {
    console.error("[flood-relief/gauges]", err);
    return res.status(500).json({ error: "บันทึกจุดวัดไม่สำเร็จ" });
  }
}
