import type { NextApiRequest, NextApiResponse } from "next";
import { routes as routesCol } from "@/lib/garbage/db";
import { zoneOrder } from "@/lib/garbage/labels";
import { requireGarbageAdmin, type GarbageAdminResult } from "../_auth";

/**
 * รายการสายพร้อมจุดเก็บ — ใช้เติม dropdown และตัวตั้งเวลารายจุดในฟอร์มแอดมิน
 * ต้องล็อกอิน: เป็นข้อมูลตั้งต้นของฟอร์ม ไม่ใช่ข้อมูลที่หน้าประชาชนต้องใช้
 * (หน้าประชาชนได้สายมาพร้อม /week และ /search แล้ว)
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
    console.error("[garbage/routes] auth", err);
    return res.status(500).json({ error: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
  }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    const rCol = await routesCol();
    // เรียงในเครื่อง ไม่ใช่ .sort({ code: 1 }) — รหัสเป็นสตริง มองโกจะได้ R1, R13, R2, ...
    // ทุก dropdown ในหน้าแอดมินอ่านจากที่นี่ที่เดียว ลำดับจึงต้องเป็น โซน 1 → โซน 7 → รถยกภาชนะรองรับ
    const routes = (await rCol.find({ active: true }).toArray())
      .sort((a, b) => zoneOrder(a.code) - zoneOrder(b.code) || a.code.localeCompare(b.code));
    return res.status(200).json({
      routes: routes.map((r) => ({
        code: r.code,
        name: r.name,
        defaultTruckNumber: r.defaultTruckNumber,
        needsVerification: r.needsVerification ?? false,
        // ฟอร์มแก้สายต้องส่งค่านี้กลับมาตอน PUT — เซิร์ฟเวอร์ใช้เทียบว่าข้อมูลเปลี่ยนไประหว่างเปิดฟอร์มไหม
        // null = เอกสารเก่าที่ยังไม่มี updatedAt (เซิร์ฟเวอร์จะข้ามการเทียบให้)
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : null,
        stops: r.stops,
      })),
    });
  } catch (err) {
    console.error("[garbage/routes] GET", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านข้อมูล" });
  }
}
