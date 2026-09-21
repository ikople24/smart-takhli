import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/garbage/db";
import { requireGarbageAdmin, type GarbageAdminResult } from "./_auth";

/**
 * รายชื่อชุมชนสำหรับ dropdown ในหน้าแอดมิน
 * อ่านจาก geojsonfeatures ซึ่งเป็นของแอปอื่น (appId app_b) — อ่านอย่างเดียว
 * ไม่ส่ง geometry ออก (payload ใหญ่และหน้าแอดมินไม่ได้ใช้)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  let auth: GarbageAdminResult;
  try {
    auth = await requireGarbageAdmin(req);
  } catch (err) {
    console.error("[garbage/communities] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const db = await getDb();
    const docs = await db
      .collection("geojsonfeatures")
      .find({ active: true })
      .project({ name: 1, _id: 0 })
      .toArray();
    const names = docs
      .map((d) => String(d.name))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "th"));
    return res.status(200).json({ communities: names });
  } catch (err) {
    console.error("[garbage/communities] GET", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
