import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/mongoNative";
import { requireSmartPaparAdmin } from "./water-quality/_auth";

/**
 * GET /api/smart-papar/communities — ขอบเขตชุมชน (polygon) สำหรับชั้นข้อมูลบนแผนที่โบตะกอน
 * อ่านจาก basemap geojsonfeatures ของแอปพี่น้อง (appId app_b) — **อ่านอย่างเดียว** ผ่าน native driver
 * (ไม่ใช้ Mongoose model เพราะ autoIndex อาจสร้าง index ลง collection ของแอปอื่น)
 * แยกจาก /api/flood-relief/communities เพราะสิทธิ์คนละชุด (เจ้าหน้าที่ประปาไม่มีสิทธิ์หน้าน้ำท่วม)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const auth = await requireSmartPaparAdmin(req).catch(() => null);
  if (!auth) return res.status(500).json({ success: false, message: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  if (!auth.ok) return res.status(auth.status ?? 403).json({ success: false, message: auth.message });

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
    console.error("[smart-papar/communities] GET", err);
    return res.status(500).json({ success: false, message: "โหลดขอบเขตชุมชนไม่สำเร็จ" });
  }
}
