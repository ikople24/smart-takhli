import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/mongoNative";
import { requireFloodAdmin } from "./_auth";

/**
 * GET /api/flood-relief/communities — ขอบเขตชุมชน 22 polygon สำหรับชั้นข้อมูลบนแผนที่แดชบอร์ด
 * อ่านจาก basemap geojsonfeatures ของแอปพี่น้อง (appId app_b) — **อ่านอย่างเดียว** ผ่าน native driver
 * (ไม่ใช้ models/GeoJSONFeature เพราะ autoIndex อาจสร้าง index ลง collection ของแอปอื่น)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }
  const auth = await requireFloodAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const db = await getDb();
    const docs = await db
      .collection("geojsonfeatures")
      .find({ active: true })
      .project<{ name: string; geometry: unknown }>({ _id: 0, name: 1, geometry: 1 })
      .toArray();
    res.setHeader("Cache-Control", "private, max-age=600");
    return res.status(200).json({
      type: "FeatureCollection",
      features: docs.map((d) => ({ type: "Feature", properties: { name: d.name }, geometry: d.geometry })),
    });
  } catch (err) {
    console.error("[flood-relief/communities] GET", err);
    return res.status(500).json({ error: "โหลดขอบเขตชุมชนไม่สำเร็จ" });
  }
}
